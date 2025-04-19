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
      // 初始化录音器
      const initialized = await initRecorder();
      if (!initialized) return;
      
      // 创建转录会话
      const response = await recordingApi.createTranscriptionSession();
      const { session_id, url } = response;
      
      // 创建WebSocket到代理URL
      const wsUrl = `/ws-proxy/${session_id}`;
      const success = await audioRecorder.startRecording(wsUrl);
      
      if (success) {
        // 更新状态
        startRecordingStore(session_id);
        
        // 添加WebSocket消息处理
        const socket = audioRecorder.getSocket();
        if (socket) {
          socket.addEventListener('message', handleMessage);
        }
      } else {
        Toast.show({
          content: '开始录音失败',
          position: 'bottom',
        });
      }
    } catch (error) {
      console.error('启动录音错误:', error);
      Toast.show({
        content: '启动录音失败',
        position: 'bottom',
      });
    }
  }, [status, startRecordingStore]);
  
  // 停止录音
  const stopRecording = useCallback(async () => {
    if (status !== 'recording') return;
    
    try {
      audioRecorder.stopRecording();
      stopRecordingStore();
      
      // 处理说话人识别
      if (messages.length > 0) {
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
          diarized_transcript.forEach(item => {
            updateSpeaker(item.id, item.speaker);
          });
        } catch (error) {
          console.error('说话人识别失败:', error);
        }
      }
    } catch (error) {
      console.error('停止录音错误:', error);
      Toast.show({
        content: '停止录音失败',
        position: 'bottom',
      });
    }
  }, [status, messages, stopRecordingStore, updateSpeaker]);
  
  // 生成会议记录文档
  const generateDocument = useCallback(async () => {
    if (status !== 'processing' || !folderToken || !user) return;
    
    try {
      setIsGeneratingDocument(true);
      
      // 生成HTML内容
      const content = transcriptToHtml(messages);
      
      // 生成标题
      const plainText = messages.map(m => m.text).join(' ');
      const { title } = await recordingApi.generateTitle(plainText);
      
      // 创建会议记录
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
    } catch (error) {
      console.error('生成文档错误:', error);
      Toast.show({
        content: '生成文档失败',
        position: 'bottom',
      });
      setIsGeneratingDocument(false);
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