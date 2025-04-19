import { create } from 'zustand';

// 定义转录片段类型
export interface TranscriptSegment {
  id: string;
  text: string;
  start?: number;
  end?: number;
  speaker?: string;
  isFinal: boolean;
}

// 录音状态
export type RecordingStatus = 'idle' | 'recording' | 'processing';

// 录音状态存储
interface RecorderState {
  status: RecordingStatus;
  duration: number;
  messages: TranscriptSegment[];
  currentSessionId: string | null;
  
  // 开始录音
  startRecording: (sessionId: string) => void;
  
  // 停止录音
  stopRecording: () => void;
  
  // 增加录音时长
  incrementDuration: () => void;
  
  // 添加消息
  addMessage: (message: TranscriptSegment) => void;
  
  // 更新消息
  updateMessage: (id: string, text: string) => void;
  
  // 设置消息为最终状态
  finalizeMessage: (id: string, text: string) => void;
  
  // 更新说话人
  updateSpeaker: (id: string, speaker: string) => void;
  
  // 重置状态
  reset: () => void;
}

export const useRecorderStore = create<RecorderState>((set) => ({
  status: 'idle',
  duration: 0,
  messages: [],
  currentSessionId: null,
  
  startRecording: (sessionId) => set({
    status: 'recording',
    duration: 0,
    currentSessionId: sessionId,
  }),
  
  stopRecording: () => set({
    status: 'processing',
    currentSessionId: null,
  }),
  
  incrementDuration: () => set((state) => ({
    duration: state.duration + 1,
  })),
  
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  
  updateMessage: (id, text) => set((state) => ({
    messages: state.messages.map((msg) => 
      msg.id === id ? { ...msg, text } : msg
    ),
  })),
  
  finalizeMessage: (id, text) => set((state) => ({
    messages: state.messages.map((msg) => 
      msg.id === id ? { ...msg, text, isFinal: true } : msg
    ),
  })),
  
  updateSpeaker: (id, speaker) => set((state) => ({
    messages: state.messages.map((msg) => 
      msg.id === id ? { ...msg, speaker } : msg
    ),
  })),
  
  reset: () => set({
    status: 'idle',
    duration: 0,
    messages: [],
    currentSessionId: null,
  }),
})); 