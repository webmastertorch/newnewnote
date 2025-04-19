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
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      
      this.audioContext = new AudioContext({
        sampleRate: 16000,
        latencyHint: 'interactive'
      });
      
      // 如果浏览器暂停了AudioContext，恢复它
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // 加载音频处理器
      await this.audioContext.audioWorklet.addModule('/audioProcessors.js');
      
      return true;
    } catch (error) {
      console.error('音频初始化失败:', error);
      return false;
    }
  }
  
  // 开始录音
  async startRecording(wsUrl: string) {
    if (!this.stream || !this.audioContext) {
      const initialized = await this.init();
      if (!initialized) return false;
    }
    
    try {
      // 创建WebSocket连接
      this.socket = new ReconnectingWebSocket(wsUrl, [], {
        connectionTimeout: 4000,
        maxRetries: 10,
        maxEnqueuedMessages: 100
      });
      
      this.socket.addEventListener('open', () => {
        console.log('WebSocket连接已建立');
      });
      
      this.socket.addEventListener('error', (error) => {
        console.error('WebSocket错误:', error);
      });
      
      // 创建音频处理节点
      this.processor = new AudioWorkletNode(this.audioContext!, 'pcm-recorder-processor');
      
      // 创建麦克风源
      const source = this.audioContext!.createMediaStreamSource(this.stream!);
      
      // 连接节点
      source.connect(this.processor);
      
      // 处理音频数据
      this.processor.port.onmessage = (event) => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(event.data);
        }
      };
      
      this.isRecording = true;
      
      // 每30秒发送心跳以保持连接
      this.recordingTimeoutId = window.setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 15000);
      
      return true;
    } catch (error) {
      console.error('开始录音失败:', error);
      return false;
    }
  }
  
  // 停止录音
  stopRecording() {
    try {
      this.isRecording = false;
      
      // 清除心跳定时器
      if (this.recordingTimeoutId) {
        clearInterval(this.recordingTimeoutId);
        this.recordingTimeoutId = null;
      }
      
      // 断开处理器
      if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
      }
      
      // 关闭WebSocket
      if (this.socket) {
        this.socket.close();
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
    this.stopRecording();
    
    // 停止麦克风流
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // 关闭音频上下文
    if (this.audioContext) {
      this.audioContext.close();
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