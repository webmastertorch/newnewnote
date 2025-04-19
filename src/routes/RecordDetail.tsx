import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NavBar, SpinLoading, Result } from 'antd-mobile';
import styles from './RecordDetail.module.css';

const RecordDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 重定向到Lark文档
  useEffect(() => {
    if (id) {
      try {
        // 打开Lark文档
        window.open(`https://www.lark.com/docs/${id}`, '_blank');
        setLoading(false);
      } catch (error) {
        setError('打开文档失败');
        setLoading(false);
      }
    } else {
      setError('无效的文档ID');
      setLoading(false);
    }
  }, [id]);
  
  return (
    <div className={styles.container}>
      <NavBar
        className={styles.navbar}
        onBack={() => navigate('/history')}
      >
        会议记录
      </NavBar>
      
      <div className={styles.content}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <SpinLoading color="primary" />
            <span className={styles.loadingText}>打开文档中...</span>
          </div>
        ) : error ? (
          <Result
            className={styles.errorResult}
            status="error"
            title="打开文档失败"
            description={error}
          />
        ) : (
          <div className={styles.redirectingContainer}>
            <Result
              status="success"
              title="文档已在新标签页打开"
              description="如果文档未自动打开，请检查是否被浏览器拦截"
            />
            <div className={styles.buttonContainer}>
              <a
                href={`https://www.lark.com/docs/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.openButton}
              >
                重新打开文档
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordDetail; 