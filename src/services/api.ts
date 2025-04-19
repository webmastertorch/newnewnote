import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuthStore.getState();
    
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // 未授权，登出
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API接口
export const authApi = {
  // 获取用户信息
  getMe: () => api.get('/me'),
  
  // OAuth登录
  oauth: (code: string) => api.post('/oauth', { code }),
};

export const folderApi = {
  // 获取用户文件夹
  getUserFolder: (openId: string) => api.get(`/folder?open_id=${openId}`),
  
  // 获取会议记录列表
  getMeetingRecords: (folderToken: string, pageToken = '', pageSize = 20) => 
    api.get(`/meeting-records?folder_token=${folderToken}&page_token=${pageToken}&page_size=${pageSize}`),
};

export const recordingApi = {
  // 创建转录会话
  createTranscriptionSession: (language = 'zh') => 
    api.post('/transcription-sessions', { language }),
  
  // 生成会议标题
  generateTitle: (text: string) => 
    api.post('/generate-title', { text }),
  
  // 说话人识别
  diarizeTranscript: (transcript: any[]) => 
    api.post('/diarize', { transcript }),
  
  // 创建会议记录
  createMeetingRecord: (folderToken: string, title: string, content: string) => 
    api.post('/meeting-records', { folder_token: folderToken, title, content }),
  
  // 更新文档标题
  updateDocumentTitle: (fileToken: string, title: string) => 
    api.patch(`/meeting-records/${fileToken}/title`, { title }),
};

export default api; 