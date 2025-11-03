import React, { useState, useCallback } from 'react';
import { Card, Image, Skeleton, Alert, Typography, Space, Button, Spin, Progress } from 'antd';
import { PictureOutlined, ReloadOutlined, EyeOutlined, ExclamationCircleOutlined, WarningOutlined, LoadingOutlined, RobotOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface AIImageDisplayProps {
  imageUrl?: string;
  word: string;
  loading?: boolean;
  error?: AIError | null;
  onRetry?: () => void;
  className?: string;
}

export const AIImageDisplay: React.FC<AIImageDisplayProps> = ({
  imageUrl,
  word,
  loading = false,
  error = null,
  onRetry,
  className = ''
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Handle image load success
  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
    setImageError(false);
  }, []);

  // Handle image load error
  const handleImageError = useCallback(() => {
    setImageLoading(false);
    setImageError(true);
  }, []);

  // Handle retry button click
  const handleRetry = useCallback(() => {
    if (onRetry) {
      setImageError(false);
      setImageLoading(true);
      onRetry();
    }
  }, [onRetry]);

  // Handle image preview
  const handlePreview = useCallback(() => {
    setPreviewVisible(true);
  }, []);

  // Render placeholder content
  const renderPlaceholder = () => (
    <div className="flex flex-col items-center justify-center h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <PictureOutlined className="text-4xl text-gray-400 mb-2" />
      <Text type="secondary">No image available</Text>
      {onRetry && (
        <Button
          type="link"
          icon={<ReloadOutlined />}
          onClick={handleRetry}
          className="mt-2"
        >
          Generate Image
        </Button>
      )}
    </div>
  );

  // Enhanced loading state with progress
  const renderLoading = () => (
    <div className="relative bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 min-h-[200px]">
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="relative">
          <Spin
            size="large"
            indicator={<LoadingOutlined style={{ fontSize: 32, color: '#1890ff' }} spin />}
          />
          <RobotOutlined className="absolute -top-1 -right-1 text-purple-500 text-lg" />
        </div>

        <div className="text-center space-y-2">
          <Typography.Title level={5} className="mb-1">
            AI is creating your visual aid
          </Typography.Title>
          <Text type="secondary" className="text-sm">
            {`Generating an educational image for "${word}"`}
          </Text>
        </div>

        <Progress
          percent={75}
          status="active"
          strokeColor={{
            '0%': '#667eea',
            '100%': '#764ba2',
          }}
          showInfo={false}
          className="w-full max-w-xs"
        />

        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1"></div>
            <span>Analyzing word meaning</span>
          </div>
          <span>•</span>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse mr-1"></div>
            <span>Creating visual representation</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Get error display properties
  const getErrorDisplay = (error: AIError) => {
    let alertType: 'error' | 'warning' | 'info' = 'warning';
    let icon = <WarningOutlined />;
    let title = 'Image Generation Failed';

    switch (error.type) {
      case 'API_KEY_MISSING':
        alertType = 'error';
        icon = <ExclamationCircleOutlined />;
        title = 'Configuration Error';
        break;
      case 'API_RATE_LIMIT':
        alertType = 'warning';
        icon = <WarningOutlined />;
        title = 'Rate Limit Exceeded';
        break;
      case 'API_NETWORK_ERROR':
        alertType = 'error';
        icon = <ExclamationCircleOutlined />;
        title = 'Network Error';
        break;
      case 'IMAGE_GENERATION_FAILED':
        alertType = 'warning';
        icon = <PictureOutlined />;
        title = 'Image Generation Failed';
        break;
      default:
        alertType = 'warning';
    }

    return { alertType, icon, title };
  };

  // Render error state
  const renderError = () => {
    if (!error) return null;

    const { alertType, icon, title } = getErrorDisplay(error);

    return (
      <Alert
        message={title}
        description={
          <div>
            <div className="mb-2">{error.message}</div>
            {error.type === 'API_KEY_MISSING' && (
              <div className="text-sm text-gray-600">
                Image generation requires a valid API key. Please check your configuration.
              </div>
            )}
            {error.type === 'API_RATE_LIMIT' && (
              <div className="text-sm text-gray-600">
                Image generation is temporarily unavailable due to rate limits. The word definition is still available above.
              </div>
            )}
            {error.type === 'API_NETWORK_ERROR' && (
              <div className="text-sm text-gray-600">
                Unable to connect to the image generation service. Please check your internet connection.
              </div>
            )}
            {error.type === 'IMAGE_GENERATION_FAILED' && (
              <div className="text-sm text-gray-600">
                The AI was unable to generate an appropriate image for this word. You can still use the definition above for learning.
              </div>
            )}
          </div>
        }
        type={alertType}
        showIcon
        icon={icon}
        action={
          onRetry && error.type !== 'API_KEY_MISSING' && (
            <Button size="small" onClick={handleRetry} icon={<ReloadOutlined />}>
              Retry
            </Button>
          )
        }
      />
    );
  };

  return (
    <Card
      className={`ai-image-display ${className}`}
      title={
        <Space align="center">
          <PictureOutlined className="text-green-500" />
          <div className="m-0 leading-tight text-lg">
            Visual Learning Aid
          </div>
        </Space>
      }
      extra={
        imageUrl && !loading && !imageError && (
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={handlePreview}
            size="small"
          >
            Preview
          </Button>
        )
      }
    >
      <div className="image-content">
        {/* Loading state */}
        {loading && renderLoading()}

        {/* Error state */}
        {!loading && (error || imageError) && renderError()}

        {/* Image display */}
        {!loading && !error && imageUrl && (
          <div className="relative">
            <Image
              src={imageUrl}
              alt={`Visual representation of "${word}"`}
              style={{
                width: '100%',
                maxHeight: '300px',
                objectFit: 'cover',
                borderRadius: '8px'
              }}
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="lazy"
              preview={{
                visible: previewVisible,
                onVisibleChange: setPreviewVisible,
                mask: (
                  <div className="flex flex-col items-center">
                    <EyeOutlined className="text-xl mb-1" />
                    <span>Preview</span>
                  </div>
                )
              }}
            />

            {/* Image loading overlay */}
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
                <Skeleton.Image style={{ width: 60, height: 60 }} active />
              </div>
            )}
          </div>
        )}

        {/* No image placeholder */}
        {!loading && !error && !imageUrl && renderPlaceholder()}

        {/* Image description with success indicator */}
        {imageUrl && !loading && !imageError && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <Space direction="vertical" size="small" className="w-full">
              <Text type="secondary" className="text-sm">
                {`AI-generated visual representation of "${word}" to aid learning and memory`}
              </Text>
              <Space align="center" className="text-green-600">
                <CheckCircleOutlined className="text-xs" />
                <Text type="secondary" className="text-xs">
                  Image generated successfully
                </Text>
              </Space>
            </Space>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AIImageDisplay;
