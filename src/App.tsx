import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd-mobile';
import zhCN from 'antd-mobile/es/locales/zh-CN';

// 导入页面组件
import Login from './routes/Login';
import Home from './routes/Home';
import HistoryList from './routes/HistoryList';
import RecordDetail from './routes/RecordDetail';

// 导入状态管理
import { useAuthStore } from './store/authStore';

// 受保护的路由
const ProtectedRoute: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } />
        <Route path="/history" element={
          <ProtectedRoute>
            <HistoryList />
          </ProtectedRoute>
        } />
        <Route path="/record/:id" element={
          <ProtectedRoute>
            <RecordDetail />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  );
};

export default App; 