import { TranscriptSegment } from "../store/recorderStore";

// 将转录段落格式化为HTML
export function transcriptToHtml(messages: TranscriptSegment[]): string {
  let html = '<h1>会议记录</h1>\n\n';
  html += `<p>时间：${new Date().toLocaleString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })}</p>\n\n`;
  
  // 按说话人分组
  let currentSpeaker = '';
  let speakerContent = '';
  
  for (const message of messages) {
    if (message.speaker !== currentSpeaker) {
      // 如果有前一个说话人的内容，添加到HTML
      if (speakerContent) {
        html += `<h3>${currentSpeaker || '未知说话人'}</h3>\n`;
        html += `<p>${speakerContent}</p>\n\n`;
      }
      
      // 重置当前说话人和内容
      currentSpeaker = message.speaker || '';
      speakerContent = message.text;
    } else {
      // 同一说话人，添加内容
      speakerContent += ' ' + message.text;
    }
  }
  
  // 添加最后一个说话人的内容
  if (speakerContent) {
    html += `<h3>${currentSpeaker || '未知说话人'}</h3>\n`;
    html += `<p>${speakerContent}</p>\n\n`;
  }
  
  return html;
}

// 格式化时间显示
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// 将毫秒时间戳格式化为时间字符串
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
} 