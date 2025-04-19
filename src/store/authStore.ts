import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 定义用户类型
export interface User {
  open_id: string;
  name: string;
  avatar_url: string;
}

// 定义认证状态
interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  folderToken: string;
  
  // 登录
  login: (data: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: User;
  }) => void;
  
  // 设置文件夹Token
  setFolderToken: (token: string) => void;
  
  // 登出
  logout: () => void;
}

// 创建认证状态存储
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      folderToken: '',
      
      login: (data) => set({
        isAuthenticated: true,
        user: data.user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      }),
      
      setFolderToken: (token) => set({
        folderToken: token
      }),
      
      logout: () => set({
        isAuthenticated: false,
        user: null,
        accessToken: '',
        refreshToken: '',
        expiresAt: 0,
        folderToken: '',
      }),
    }),
    {
      name: 'larknote-auth', // localStorage的键名
    }
  )
); 