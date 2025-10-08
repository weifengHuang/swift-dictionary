import React from 'react';
import { Card, Typography, Skeleton, Alert, Space, Button, Spin } from 'antd';
import { BookOutlined, ClockCircleOutlined, ReloadOutlined, ExclamationCircleOutlined, LoadingOutlined, CheckCircleOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { Title, Text } = Typography;

interface WordDefinitionDisplayProps {
  definition: string;
  word: string;
  timestamp?: number;
  loading?: boolean;
  error?: AIError | null;
  className?: string;
  onRetry?: () => void;
  streaming?: boolean;
  streamingText?: string;
}

export const WordDefinitionDisplay: React.FC<WordDefinitionDisplayProps> = ({
  definition,
  word,
  timestamp,
  loading = false,
  error = null,
  className = '',
  onRetry,
  streaming = false,
  streamingText = ''
}) => {
  // Format timestamp for display
  const formatTimestamp = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleString();
  };

  // Render markdown content with custom components
  const renderMarkdownContent = (text: string, isStreaming = false) => {
    // In streaming mode, always show container even if text is empty
    if (!text && !isStreaming) return null;
    
    return (
      <div className={`markdown-content ${isStreaming ? 'streaming' : ''}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children, ...props }) => (
              <Typography.Title level={2} className="text-blue-600 mb-4" {...props}>
                {children}
              </Typography.Title>
            ),
            h2: ({ children, ...props }) => (
              <Typography.Title level={3} className="text-blue-700 mb-3" {...props}>
                {children}
              </Typography.Title>
            ),
            h3: ({ children, ...props }) => (
              <Typography.Title level={4} className="text-blue-800 mb-2" {...props}>
                {children}
              </Typography.Title>
            ),
            p: ({ children, ...props }) => (
              <Typography.Paragraph className="mb-3" {...props}>
                {children}
              </Typography.Paragraph>
            ),
            strong: ({ children, ...props }) => (
              <Text strong className="text-blue-600" {...props}>
                {children}
              </Text>
            ),
            em: ({ children, ...props }) => (
              <Text italic className="text-gray-600" {...props}>
                {children}
              </Text>
            ),
            ul: ({ children, ...props }) => (
              <ul className="list-disc list-inside mb-3 space-y-1" {...props}>
                {children}
              </ul>
            ),
            ol: ({ children, ...props }) => (
              <ol className="list-decimal list-inside mb-3 space-y-1" {...props}>
                {children}
              </ol>
            ),
            li: ({ children, ...props }) => (
              <li className="mb-1" {...props}>
                {children}
              </li>
            ),
            code: ({ children, ...props }) => (
              <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            ),
            blockquote: ({ children, ...props }) => (
              <blockquote className="border-l-4 border-blue-300 pl-4 italic text-gray-600 mb-3" {...props}>
                {children}
              </blockquote>
            )
          }}
        >
          {text || (isStreaming ? '' : '')}
        </ReactMarkdown>
      </div>
    );
  };

  // Enhanced Loading state
  if (loading) {
    return (
      <Card 
        className={`word-definition-display ${className}`}
        title={
          <Space align="center">
            <Spin 
              size="small" 
              indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />}
            />
            <span>Loading Definition...</span>
          </Space>
        }
      >
        <div className="space-y-4">
          <Skeleton.Input style={{ width: '60%' }} active />
          <Skeleton active paragraph={{ rows: 3 }} />
          <Skeleton.Input style={{ width: '80%' }} active />
          <Skeleton active paragraph={{ rows: 2 }} />
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-200 text-center">
          <Space align="center" className="text-gray-500">
            <LoadingOutlined className="text-blue-500" />
            <span className="text-sm">Fetching comprehensive definition from AI...</span>
          </Space>
        </div>
      </Card>
    );
  }

  // Get error message and type for display
  const getErrorDisplay = (error: AIError) => {
    let alertType: 'error' | 'warning' | 'info' = 'error';
    const icon = <ExclamationCircleOutlined />;
    
    switch (error.type) {
      case 'API_KEY_MISSING':
        alertType = 'warning';
        break;
      case 'API_RATE_LIMIT':
        alertType = 'warning';
        break;
      case 'API_NETWORK_ERROR':
        alertType = 'error';
        break;
      default:
        alertType = 'error';
    }
    
    return { alertType, icon };
  };

  // Error state
  if (error) {
    const { alertType, icon } = getErrorDisplay(error);
    
    return (
      <Card className={`word-definition-display ${className}`}>
        <Alert
          message="Definition Error"
          description={
            <div>
              <div className="mb-2">{error.message}</div>
              {error.type === 'API_KEY_MISSING' && (
                <div className="text-sm text-gray-600">
                  Please check your .env file and ensure GEMINI_API_KEY is properly configured.
                </div>
              )}
              {error.type === 'API_RATE_LIMIT' && (
                <div className="text-sm text-gray-600">
                  You have reached the API rate limit. Please wait a few minutes before trying again.
                </div>
              )}
              {error.type === 'API_NETWORK_ERROR' && (
                <div className="text-sm text-gray-600">
                  Please check your internet connection and try again.
                </div>
              )}
            </div>
          }
          type={alertType}
          showIcon
          icon={icon}
          action={
            onRetry && (
              <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
                Retry
              </Button>
            )
          }
        />
      </Card>
    );
  }

  // No definition available - but allow streaming mode
  if (!word || (!definition && !streaming)) {
    return null;
  }

  return (
    <Card 
      className={`word-definition-display ${className}`}
      title={
        <div className="flex items-center">
          <BookOutlined className="text-blue-500 text-xl" />
          <div className="m-0 leading-tight text-lg">
            {word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()}
          </div>
        </div>
      }
      extra={
        timestamp && (
          <Space align="center" className="text-gray-500">
            <ClockCircleOutlined />
            <Text type="secondary" className="text-sm">
              {formatTimestamp(timestamp)}
            </Text>
          </Space>
        )
      }
    >
      <div className="definition-content">
        {/* Main definition content */}
        <div className="definition-text">
          {streaming ? (
            <div>
              <div className="mb-3 text-sm text-blue-600">
                <LoadingOutlined className="mr-2" />
                AI is generating definition...
              </div>
              {streamingText && renderMarkdownContent(streamingText, true)}
              {!streamingText && (
                <div className="text-gray-500 italic">
                  Waiting for response...
                </div>
              )}
            </div>
          ) : (
            renderMarkdownContent(definition)
          )}
        </div>
        
        {/* Success indicator */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex justify-end">
            <Space align="center" className="text-green-600">
              <CheckCircleOutlined className="text-xs" />
              <Text type="secondary" className="text-xs">
                Successfully loaded
              </Text>
            </Space>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default WordDefinitionDisplay;
