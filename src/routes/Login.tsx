import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, SpinLoading, Toast } from 'antd-mobile';
import { useAuthStore } from '../store/authStore';
import { authApi, folderApi } from '../services/api';
import styles from './Login.module.css';

// Lark App ID
const LARK_APP_ID = import.meta.env.VITE_LARK_APP_ID || '';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login, setFolderToken, user } = useAuthStore();

  // 如果已经登录，跳转到首页
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // 处理从URL获取的授权码
  useEffect(() => {
    const handleAuthCode = async (code: string) => {
      try {
        // 使用授权码获取令牌
        const tokenData = await authApi.oauth(code);

        // 登录
        login(tokenData);

        // 获取用户文件夹
        const { folder_token } = await folderApi.getUserFolder(tokenData.user.open_id);
        setFolderToken(folder_token);

        // 清除URL中的授权码
        window.history.replaceState(null, '', location.pathname);

        // 跳转到首页
        navigate('/');
      } catch (error) {
        console.error('登录失败:', error);
        Toast.show({
          content: '登录失败，请重试',
          position: 'bottom',
        });
      }
    };

    // 从URL获取授权码
    const urlParams = new URLSearchParams(location.search);
    const code = urlParams.get('code');

    if (code) {
      handleAuthCode(code);
    }
  }, [location, login, navigate, setFolderToken]);

  // 处理Lark登录
  const handleLarkLogin = () => {
    // 修改 document.domain
    try {
      // @ts-ignore
      document.domain = 'larksuite.com';
    } catch (error) {
      console.warn('设置document.domain失败:', error);
    }

    // 为移动端跳转设置重定向URL - 使用固定的重定向URL
    // 注意：这个URL必须与飞书开放平台应用设置中的重定向URL完全一致
    const redirectUri = encodeURIComponent(window.location.origin + '/login');

    console.log('使用重定向URL:', redirectUri);

    // 使用Lark提供的SDK函数开始授权流程
    if (window.lark) {
      window.lark.requestAuthCode({
        appId: LARK_APP_ID,
        redirectUri: redirectUri,
      });
    } else {
      // 如果SDK未加载，直接跳转到授权页面
      const authUrl = `https://open.larksuite.com/open-apis/authen/v1/index?redirect_uri=${redirectUri}&app_id=${LARK_APP_ID}`;
      console.log('授权URL:', authUrl);
      window.location.href = authUrl;
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <h1 className={styles.title}>AI会议记录系统</h1>
        <div className={styles.logo}>
          <img src="/logo.png" alt="Logo" />
        </div>
        <Button
          block
          color="primary"
          className={styles.loginButton}
          onClick={handleLarkLogin}
        >
          Lark登录
        </Button>
      </div>
    </div>
  );
};

export default Login;
