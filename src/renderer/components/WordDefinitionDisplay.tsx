import React from 'react';
import { Card, Typography, Skeleton, Alert, Tag, Space, Button, Spin } from 'antd';
import { BookOutlined, ClockCircleOutlined, ReloadOutlined, ExclamationCircleOutlined, LoadingOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

interface WordDefinitionDisplayProps {
  definition: string;
  word: string;
  timestamp?: number;
  loading?: boolean;
  error?: AIError | null;
  className?: string;
  onRetry?: () => void;
}

export const WordDefinitionDisplay: React.FC<WordDefinitionDisplayProps> = ({
  definition,
  word,
  timestamp,
  loading = false,
  error = null,
  className = '',
  onRetry
}) => {
  // Format timestamp for display
  const formatTimestamp = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleString();
  };

  // Format definition text for better readability
  const formatDefinition = (text: string) => {
    if (!text) return '';
    
    // Split by common definition separators and format
    const lines = text.split('\n').filter(line => line.trim());
    
    return lines.map((line, index) => {
      const trimmedLine = line.trim();
      
      // Check if line looks like a numbered definition
      if (/^\d+\./.test(trimmedLine)) {
        return (
          <div key={index} className="mb-2">
            <Text strong className="text-blue-600">{trimmedLine}</Text>
          </div>
        );
      }
      
      // Check if line looks like a part of speech or category
      if (/^(noun|verb|adjective|adverb|preposition|conjunction|interjection|pronoun)/i.test(trimmedLine)) {
        return (
          <div key={index} className="mb-2">
            <Tag color="blue" className="mb-1">{trimmedLine}</Tag>
          </div>
        );
      }
      
      // Check if line contains examples (usually in quotes or parentheses)
      if (/["'()]/.test(trimmedLine)) {
        return (
          <div key={index} className="mb-2">
            <Text italic className="text-gray-600">{trimmedLine}</Text>
          </div>
        );
      }
      
      // Regular definition text
      return (
        <Paragraph key={index} className="mb-2">
          {trimmedLine}
        </Paragraph>
      );
    });
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
    let icon = <ExclamationCircleOutlined />;
    
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
                  You've reached the API rate limit. Please wait a few minutes before trying again.
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

  // No definition available
  if (!definition || !word) {
    return null;
  }

  return (
    <Card 
      className={`word-definition-display ${className}`}
      title={
        <Space align="center">
          <BookOutlined className="text-blue-500" />
          <Title level={4} className="mb-0">
            {word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()}
          </Title>
        </Space>
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
          {formatDefinition(definition)}
        </div>
        
        {/* Source attribution with success indicator */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <Space align="center" className="w-full justify-between">
            <Text type="secondary" className="text-xs">
              Definition provided by Gemini AI
            </Text>
            <Space align="center" className="text-green-600">
              <CheckCircleOutlined className="text-xs" />
              <Text type="secondary" className="text-xs">
                Successfully loaded
              </Text>
            </Space>
          </Space>
        </div>
      </div>
    </Card>
  );
};

export default WordDefinitionDisplay;