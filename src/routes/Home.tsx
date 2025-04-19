import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Button, Dialog, Toast } from 'antd-mobile';
import { 
  HistogramOutline,
  UserOutline,
  CloseCircleOutline
} from 'antd-mobile-icons';
import { useAuthStore } from '../store/authStore';
import { useRecorder } from '../hooks/useRecorder';
import { formatTime } from '../utils/formatHtml';
import MessageList from '../components/MessageList';
import styles from './Home.module.css';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [meetingTitle, setMeetingTitle] = useState('');
  const { user, logout } = useAuthStore();
  
  const {
    status,
    duration,
    messages,
    isInitializing,
    isGeneratingDocument,
    startRecording,
    stopRecording,
    generateDocument
  } = useRecorder();
  
  // 打开历史记录列表
  const openHistory = () => {
    navigate('/history');
  };
  
  // 处理登出
  const handleLogout = async () => {
    const result = await Dialog.confirm({
      content: '确定要退出登录吗？',
    });
    
    if (result) {
      logout();
      navigate('/login');
    }
  };
  
  // 结束录制并生成文档
  const finishRecording = async () => {
    if (status === 'recording') {
      await stopRecording();
    }
    
    if (status === 'processing') {
      const document = await generateDocument();
      
      if (document && document.token) {
        // 打开飞书文档
        window.open(`https://www.feishu.cn/docs/${document.token}`, '_blank');
      }
    }
  };
  
  // 渲染录音控制按钮
  const renderRecordingControls = () => {
    switch (status) {
      case 'idle':
        return (
          <Button
            color="primary"
            size="large"
            className={styles.startButton}
            onClick={startRecording}
            loading={isInitializing}
            disabled={isInitializing}
          >
            {isInitializing ? '准备中...' : '开始记录'}
          </Button>
        );
        
      case 'recording':
        return (
          <div className={styles.controlsContainer}>
            <Button
              color="primary"
              size="large"
              className={styles.recordingButton}
            >
              录制中 {formatTime(duration)}
            </Button>
            <Button
              color="danger"
              size="large"
              className={styles.stopButton}
              onClick={stopRecording}
            >
              结束
            </Button>
          </div>
        );
        
      case 'processing':
        return (
          <Button
            color="success"
            size="large"
            className={styles.generateButton}
            onClick={generateDocument}
            loading={isGeneratingDocument}
            disabled={isGeneratingDocument}
          >
            {isGeneratingDocument ? '生成中...' : '生成文档'}
          </Button>
        );
    }
  };
  
  return (
    <div className={styles.container}>
      <NavBar
        className={styles.navbar}
        backArrow={false}
        left={
          <div className={styles.navItem} onClick={openHistory}>
            <HistogramOutline fontSize={24} />
          </div>
        }
        right={
          <div className={styles.userInfo} onClick={handleLogout}>
            {user?.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user.name} 
                className={styles.avatar} 
              />
            ) : (
              <UserOutline fontSize={24} />
            )}
            <span className={styles.userName}>{user?.name}</span>
          </div>
        }
      >
        AI会议记录
      </NavBar>
      
      <div className={styles.content}>
        <div className={styles.messageContainer}>
          <MessageList messages={messages} />
        </div>
        
        <div className={styles.controlsWrapper}>
          {renderRecordingControls()}
        </div>
      </div>
    </div>
  );
};

export default Home; 