// PCM录音处理器
class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }
  
  process(inputs, outputs, parameters) {
    // 获取输入数据（单声道）
    const input = inputs[0][0];
    
    if (!input) return true;
    
    // 将音频数据添加到缓冲区
    for (let i = 0; i < input.length; i++) {
      this.buffer[this.bufferIndex++] = input[i];
      
      // 当缓冲区填满时，发送给主线程
      if (this.bufferIndex >= this.bufferSize) {
        // 将Float32转换为Int16（16位PCM）
        const pcmBuffer = new Int16Array(this.bufferSize);
        for (let j = 0; j < this.bufferSize; j++) {
          // 将-1到1的浮点数转换为-32768到32767的整数
          pcmBuffer[j] = Math.max(-1, Math.min(1, this.buffer[j])) * 0x7FFF;
        }
        
        // 转发到主线程
        this.port.postMessage(pcmBuffer.buffer, [pcmBuffer.buffer]);
        
        // 重置缓冲区
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
      }
    }
    
    return true;
  }
}

// 注册处理器
registerProcessor('pcm-recorder-processor', PCMRecorderProcessor); 