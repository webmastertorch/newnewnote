import React, { useEffect, useRef } from 'react';
import { TranscriptSegment } from '../store/recorderStore';
import { formatTimestamp } from '../utils/formatHtml';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: TranscriptSegment[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 自动滚动到最新消息
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // 按说话人分组消息
  const groupedMessages: { [key: string]: TranscriptSegment[] } = {};
  
  messages.forEach((message) => {
    const speaker = message.speaker || '未知说话人';
    if (!groupedMessages[speaker]) {
      groupedMessages[speaker] = [];
    }
    groupedMessages[speaker].push(message);
  });
  
  // 如果没有消息，显示提示
  if (messages.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🎙️</div>
        <p>点击"开始记录"按钮开始会议记录</p>
      </div>
    );
  }
  
  return (
    <div className={styles.messageList}>
      {Object.entries(groupedMessages).map(([speaker, speakerMessages], index) => (
        <div key={`${speaker}-${index}`} className={styles.messageGroup}>
          <div className={styles.messageBubble}>
            <div className={styles.messageHeader}>
              <span className={styles.messageSpeaker}>{speaker}</span>
              {speakerMessages[0].start && (
                <span className={styles.messageTime}>
                  {formatTimestamp(speakerMessages[0].start * 1000)}
                </span>
              )}
            </div>
            <div className={styles.messageContent}>
              {speakerMessages.map((message, i) => (
                <span 
                  key={message.id} 
                  className={`${styles.messageText} ${message.isFinal ? styles.final : styles.pending}`}
                >
                  {message.text}{' '}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList; 