import { useCallback, useEffect, useState } from 'react';
import { Toast } from 'antd-mobile';
import { useRecorderStore } from '../store/recorderStore';
import { recordingApi } from '../services/api';
import audioRecorder from '../utils/audioRecorder';
import { transcriptToHtml } from '../utils/formatHtml';
import { useAuthStore } from '../store/authStore';

// 使用录音功能的Hook
export function useRecorder() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);

  const {
    status,
    duration,
    messages,
    currentSessionId,
    startRecording: startRecordingStore,
    stopRecording: stopRecordingStore,
    incrementDuration,
    addMessage,
    updateMessage,
    finalizeMessage,
    updateSpeaker,
    reset
  } = useRecorderStore();

  const { folderToken, user } = useAuthStore();

  // 初始化录音器
  const initRecorder = useCallback(async () => {
    setIsInitializing(true);
    const success = await audioRecorder.init();
    setIsInitializing(false);

    if (!success) {
      Toast.show({
        content: '无法访问麦克风，请检查权限',
        position: 'bottom',
      });
    }

    return success;
  }, []);

  // 开始录音
  const startRecording = useCallback(async () => {
    if (status === 'recording') return;

    try {
      // 检查是否有文件夹Token
      if (!folderToken) {
        Toast.show({
          content: '未找到文件夹，请重新登录',
          position: 'bottom',
        });
        return;
      }

      // 初始化录音器
      Toast.show({
        content: '正在初始化麦克风...',
        position: 'bottom',
        duration: 1000,
      });

      const initialized = await initRecorder();
      if (!initialized) {
        Toast.show({
          content: '无法访问麦克风，请检查权限',
          position: 'bottom',
        });
        return;
      }

      // 创建转录会话
      Toast.show({
        content: '正在创建转录会话...',
        position: 'bottom',
        duration: 1000,
      });

      let response;
      try {
        response = await recordingApi.createTranscriptionSession();
      } catch (apiError) {
        console.error('创建转录会话失败:', apiError);
        Toast.show({
          content: '创建转录会话失败，请检查网络连接',
          position: 'bottom',
        });
        return;
      }

      const { session_id } = response;
      if (!session_id) {
        Toast.show({
          content: '创建转录会话失败，请重试',
          position: 'bottom',
        });
        return;
      }

      // 创建WebSocket到代理URL
      const wsUrl = `/ws-proxy/${session_id}`;

      Toast.show({
        content: '正在启动录音...',
        position: 'bottom',
        duration: 1000,
      });

      const success = await audioRecorder.startRecording(wsUrl);

      if (success) {
        // 更新状态
        startRecordingStore(session_id);

        // 添加WebSocket消息处理
        const socket = audioRecorder.getSocket();
        if (socket) {
          socket.addEventListener('message', handleMessage);

          // 添加错误处理
          socket.addEventListener('error', (event) => {
            console.error('WebSocket错误:', event);
            Toast.show({
              content: '连接错误，请重试',
              position: 'bottom',
            });
          });

          // 添加关闭处理
          socket.addEventListener('close', (event) => {
            if (status === 'recording') {
              console.warn('WebSocket意外关闭:', event);
              Toast.show({
                content: '连接已断开，请重试',
                position: 'bottom',
              });
              stopRecordingStore();
            }
          });
        }

        Toast.show({
          content: '录音已开始',
          position: 'bottom',
        });
      } else {
        Toast.show({
          content: '开始录音失败，请重试',
          position: 'bottom',
        });
      }
    } catch (error) {
      console.error('启动录音错误:', error);
      Toast.show({
        content: `启动录音失败: ${error.message || '未知错误'}`,
        position: 'bottom',
      });
      // 重置状态
      reset();
    }
  }, [status, startRecordingStore]);

  // 停止录音
  const stopRecording = useCallback(async () => {
    if (status !== 'recording') return;

    try {
      Toast.show({
        content: '正在停止录音...',
        position: 'bottom',
        duration: 1000,
      });

      // 停止录音器
      const stopped = audioRecorder.stopRecording();
      if (!stopped) {
        console.warn('停止录音器返回失败');
      }

      // 更新状态
      stopRecordingStore();

      // 如果没有消息，直接返回
      if (messages.length === 0) {
        Toast.show({
          content: '没有检测到语音，请重试',
          position: 'bottom',
        });
        reset();
        return;
      }

      // 处理说话人识别
      Toast.show({
        content: '正在识别说话人...',
        position: 'bottom',
        duration: 1500,
      });

      try {
        const diarizeResponse = await recordingApi.diarizeTranscript(
          messages.map(m => ({
            id: m.id,
            text: m.text,
            start: m.start,
            end: m.end
          }))
        );

        // 更新说话人信息
        const { diarized_transcript } = diarizeResponse;
        if (diarized_transcript && Array.isArray(diarized_transcript)) {
          diarized_transcript.forEach(item => {
            if (item && item.id && item.speaker) {
              updateSpeaker(item.id, item.speaker);
            }
          });

          Toast.show({
            content: '录音已完成，可以生成会议记录',
            position: 'bottom',
          });
        } else {
          console.error('说话人识别返回数据格式错误');
          Toast.show({
            content: '说话人识别失败，但可以继续生成记录',
            position: 'bottom',
          });
        }
      } catch (error) {
        console.error('说话人识别失败:', error);
        Toast.show({
          content: '说话人识别失败，但可以继续生成记录',
          position: 'bottom',
        });
      }
    } catch (error) {
      console.error('停止录音错误:', error);
      Toast.show({
        content: `停止录音失败: ${error.message || '未知错误'}`,
        position: 'bottom',
      });
    }
  }, [status, messages, stopRecordingStore, updateSpeaker, reset]);

  // 生成会议记录文档
  const generateDocument = useCallback(async () => {
    if (status !== 'processing') {
      Toast.show({
        content: '当前状态不能生成文档',
        position: 'bottom',
      });
      return;
    }

    if (!folderToken) {
      Toast.show({
        content: '未找到文件夹，请重新登录',
        position: 'bottom',
      });
      return;
    }

    if (!user) {
      Toast.show({
        content: '用户信息不完整，请重新登录',
        position: 'bottom',
      });
      return;
    }

    if (messages.length === 0) {
      Toast.show({
        content: '没有可用的转录内容',
        position: 'bottom',
      });
      return;
    }

    try {
      setIsGeneratingDocument(true);

      Toast.show({
        content: '正在生成会议记录...',
        position: 'bottom',
        duration: 1500,
      });

      // 生成HTML内容
      const content = transcriptToHtml(messages);

      // 生成标题
      Toast.show({
        content: '正在生成标题...',
        position: 'bottom',
        duration: 1500,
      });

      let title;
      try {
        const plainText = messages.map(m => m.text).join(' ');
        const response = await recordingApi.generateTitle(plainText);
        title = response.title;

        if (!title) {
          title = `会议记录-${new Date().toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}`;
        }
      } catch (titleError) {
        console.error('生成标题失败:', titleError);
        // 使用默认标题
        title = `会议记录-${new Date().toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      }

      // 创建会议记录
      Toast.show({
        content: '正在保存到Lark云文档...',
        position: 'bottom',
        duration: 1500,
      });

      try {
        const { document } = await recordingApi.createMeetingRecord(
          folderToken,
          title,
          content
        );

        Toast.show({
          content: '会议记录已生成',
          position: 'bottom',
        });

        // 重置状态
        reset();
        setIsGeneratingDocument(false);

        return document;
      } catch (saveError) {
        console.error('保存文档失败:', saveError);
        Toast.show({
          content: `保存文档失败: ${saveError.message || '网络错误'}`,
          position: 'bottom',
        });
        setIsGeneratingDocument(false);
        return null;
      }
    } catch (error) {
      console.error('生成文档错误:', error);
      Toast.show({
        content: `生成文档失败: ${error.message || '未知错误'}`,
        position: 'bottom',
      });
      setIsGeneratingDocument(false);
      return null;
    }
  }, [status, messages, folderToken, user, reset]);

  // 处理WebSocket消息
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'pong') {
        // 心跳响应，忽略
        return;
      } else if (data.type === 'transcription.item.delta') {
        // 增量更新
        updateMessage(data.item_id, data.delta);
      } else if (data.type === 'transcription.item.completed') {
        // 段落完成
        finalizeMessage(data.item_id, data.transcript);
      } else if (data.type === 'transcription.item.started') {
        // 新段落开始
        addMessage({
          id: data.item_id,
          text: '',
          start: data.start_time,
          end: data.end_time,
          isFinal: false
        });
      }
    } catch (error) {
      console.error('处理WebSocket消息错误:', error);
    }
  }, [addMessage, updateMessage, finalizeMessage]);

  // 录音计时器
  useEffect(() => {
    let timerId: number | null = null;

    if (status === 'recording') {
      timerId = window.setInterval(() => {
        incrementDuration();
      }, 1000);
    }

    return () => {
      if (timerId !== null) {
        clearInterval(timerId);
      }
    };
  }, [status, incrementDuration]);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      if (audioRecorder.isActive()) {
        audioRecorder.cleanup();
      }
    };
  }, []);

  return {
    status,
    duration,
    messages,
    isInitializing,
    isGeneratingDocument,
    startRecording,
    stopRecording,
    generateDocument
  };
}