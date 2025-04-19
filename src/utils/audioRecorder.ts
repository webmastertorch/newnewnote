import ReconnectingWebSocket from 'reconnecting-websocket';

class AudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: AudioWorkletNode | null = null;
  private socket: ReconnectingWebSocket | null = null;
  private isRecording = false;
  private recordingTimeoutId: number | null = null;

  // 初始化并请求麦克风权限
  async init() {
    try {
      // 检查浏览器兼容性
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('浏览器不支持媒体设备API');
      }

      // 请求麦克风权限
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      // 检查AudioContext兼容性
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('浏览器不支持AudioContext');
      }

      this.audioContext = new AudioContextClass({
        sampleRate: 16000,
        latencyHint: 'interactive'
      });

      // 如果浏览器暂停了AudioContext，恢复它
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // 检查AudioWorklet兼容性
      if (!this.audioContext.audioWorklet) {
        throw new Error('浏览器不支持AudioWorklet');
      }

      // 加载音频处理器
      try {
        // 使用绝对路径确保在任何路由下都能加载
        const processorPath = window.location.origin + '/audioProcessors.js';
        await this.audioContext.audioWorklet.addModule(processorPath);
      } catch (workletError) {
        console.error('加载音频处理器失败:', workletError);
        throw new Error(`加载音频处理器失败: ${workletError.message}`);
      }

      return true;
    } catch (error) {
      console.error('音频初始化失败:', error);
      // 清理可能已创建的资源
      this.cleanup();
      return false;
    }
  }

  // 开始录音
  async startRecording(wsUrl: string) {
    if (!wsUrl) {
      console.error('无效的WebSocket URL');
      return false;
    }

    // 如果已经在录音，先停止
    if (this.isRecording) {
      this.stopRecording();
    }

    // 确保初始化
    if (!this.stream || !this.audioContext) {
      const initialized = await this.init();
      if (!initialized) {
        console.error('音频初始化失败');
        return false;
      }
    }

    try {
      // 创建WebSocket连接
      this.socket = new ReconnectingWebSocket(wsUrl, [], {
        connectionTimeout: 4000,
        maxRetries: 10,
        maxEnqueuedMessages: 100
      });

      // 设置连接超时
      const connectionPromise = new Promise<boolean>((resolve, reject) => {
        // 连接成功
        this.socket!.addEventListener('open', () => {
          console.log('WebSocket连接已建立');
          resolve(true);
        });

        // 连接错误
        this.socket!.addEventListener('error', (error) => {
          console.error('WebSocket错误:', error);
          reject(new Error(`WebSocket连接错误: ${error}`));
        });

        // 连接关闭
        this.socket!.addEventListener('close', (event) => {
          if (!this.isRecording) {
            console.log('WebSocket连接已关闭');
            reject(new Error(`WebSocket连接关闭: 代码 ${event.code}`));
          }
        });

        // 设置超时
        setTimeout(() => reject(new Error('WebSocket连接超时')), 5000);
      });

      // 等待连接建立
      try {
        await connectionPromise;
      } catch (error) {
        console.error('建立 WebSocket 连接失败:', error);
        this.cleanup();
        return false;
      }

      // 创建音频处理节点
      try {
        this.processor = new AudioWorkletNode(this.audioContext!, 'pcm-recorder-processor');
      } catch (error) {
        console.error('创建音频处理节点失败:', error);
        this.cleanup();
        return false;
      }

      // 创建麦克风源
      const source = this.audioContext!.createMediaStreamSource(this.stream!);

      // 连接节点
      source.connect(this.processor);

      // 处理音频数据
      this.processor.port.onmessage = (event) => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          try {
            this.socket.send(event.data);
          } catch (error) {
            console.error('发送音频数据失败:', error);
          }
        }
      };

      this.isRecording = true;

      // 每15秒发送心跳以保持连接
      this.recordingTimeoutId = window.setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          try {
            this.socket.send(JSON.stringify({ type: 'ping' }));
          } catch (error) {
            console.error('发送心跳失败:', error);
          }
        }
      }, 15000);

      return true;
    } catch (error) {
      console.error('开始录音失败:', error);
      this.cleanup();
      return false;
    }
  }

  // 停止录音
  stopRecording() {
    if (!this.isRecording) {
      return true; // 如果没有在录音，直接返回
    }

    try {
      this.isRecording = false;

      // 清除心跳定时器
      if (this.recordingTimeoutId) {
        clearInterval(this.recordingTimeoutId);
        this.recordingTimeoutId = null;
      }

      // 断开处理器
      if (this.processor) {
        try {
          this.processor.disconnect();
        } catch (error) {
          console.warn('断开音频处理器时出错:', error);
        }
        this.processor = null;
      }

      // 关闭WebSocket
      if (this.socket) {
        try {
          // 发送关闭消息
          if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'close' }));
          }
          this.socket.close();
        } catch (error) {
          console.warn('关闭WebSocket时出错:', error);
        }
        this.socket = null;
      }

      return true;
    } catch (error) {
      console.error('停止录音失败:', error);
      return false;
    }
  }

  // 清理资源
  cleanup() {
    // 先停止录音
    this.stopRecording();

    // 停止麦克风流
    if (this.stream) {
      try {
        this.stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (error) {
            console.warn('停止音频轨道时出错:', error);
          }
        });
      } catch (error) {
        console.warn('处理音频轨道时出错:', error);
      }
      this.stream = null;
    }

    // 关闭音频上下文
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (error) {
        console.warn('关闭音频上下文时出错:', error);
      }
      this.audioContext = null;
    }
  }

  // 获取WebSocket连接，用于添加消息处理器
  getSocket() {
    return this.socket;
  }

  // 判断是否正在录音
  isActive() {
    return this.isRecording;
  }
}

// 创建单例
const recorder = new AudioRecorder();
export default recorder;