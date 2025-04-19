import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  NavBar,
  List,
  InfiniteScroll,
  DotLoading,
  Empty,
  SpinLoading
} from 'antd-mobile';
import { useAuthStore } from '../store/authStore';
import { folderApi } from '../services/api';
import styles from './HistoryList.module.css';

// 文档类型
interface MeetingRecord {
  name: string;
  token: string;
  create_time?: string;
}

const HistoryList: React.FC = () => {
  const navigate = useNavigate();
  const { folderToken } = useAuthStore();

  const [records, setRecords] = useState<MeetingRecord[]>([]);
  const [pageToken, setPageToken] = useState<string>('');
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  // 初始加载
  useEffect(() => {
    if (folderToken) {
      loadInitialRecords();
    }
  }, [folderToken]);

  // 加载初始记录
  const loadInitialRecords = async () => {
    try {
      setLoading(true);
      const response = await folderApi.getMeetingRecords(folderToken);

      setRecords(response.files || []);
      setPageToken(response.pageToken || '');
      setHasMore(response.hasMore || false);
    } catch (error) {
      console.error('加载会议记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载更多记录
  const loadMore = async () => {
    if (!pageToken || !folderToken) return;

    try {
      const response = await folderApi.getMeetingRecords(folderToken, pageToken);

      setRecords([...records, ...(response.files || [])]);
      setPageToken(response.pageToken || '');
      setHasMore(response.hasMore || false);
    } catch (error) {
      console.error('加载更多会议记录失败:', error);
      setHasMore(false);
    }
  };

  // 打开文档
  const openDocument = (token: string) => {
    window.open(`https://www.larksuite.com/docs/${token}`, '_blank');
  };

  // 格式化日期
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.container}>
      <NavBar
        className={styles.navbar}
        onBack={() => navigate('/')}
      >
        历史记录
      </NavBar>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <SpinLoading color="primary" />
            <span className={styles.loadingText}>加载中...</span>
          </div>
        ) : records.length === 0 ? (
          <Empty
            className={styles.empty}
            description="暂无会议记录"
            imageStyle={{ width: 128 }}
          />
        ) : (
          <>
            <List className={styles.list}>
              {records.map((record) => (
                <List.Item
                  key={record.token}
                  onClick={() => openDocument(record.token)}
                  arrow={false}
                  className={styles.listItem}
                >
                  <div className={styles.recordInfo}>
                    <div className={styles.recordName}>{record.name}</div>
                    <div className={styles.recordTime}>
                      {formatDate(record.create_time)}
                    </div>
                  </div>
                </List.Item>
              ))}
            </List>

            <InfiniteScroll loadMore={loadMore} hasMore={hasMore}>
              {(hasMore) ? (
                <div className={styles.loadingMore}>
                  <span>加载中</span>
                  <DotLoading />
                </div>
              ) : (
                <div className={styles.loadingEnd}>- 已经到底了 -</div>
              )}
            </InfiniteScroll>
          </>
        )}
      </div>
    </div>
  );
};

export default HistoryList;