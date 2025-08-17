import React, { useEffect, useState } from 'react';
import { Layout, Alert, Spin, Typography, Space } from 'antd';
import { ExclamationCircleOutlined, RobotOutlined, LoadingOutlined } from '@ant-design/icons';
import AISearchComponent from '../../components/AISearchComponent';

const { Content } = Layout;
const { Title, Text } = Typography;

const AIMode: React.FC = () => {
  const [configChecked, setConfigChecked] = useState(false);
  const [configValid, setConfigValid] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Check AI configuration on component mount
  useEffect(() => {
    const checkConfiguration = async () => {
      try {
        const isConfigured = await window.ipcRenderer.invoke<boolean>('check-ai-config');
        setConfigValid(isConfigured);
        
        if (!isConfigured) {
          setConfigError(
            'AI configuration is missing. Please ensure your .env file contains the required Gemini API key.'
          );
        }
      } catch (error) {
        console.error('Failed to check AI configuration:', error);
        setConfigValid(false);
        setConfigError('Failed to check AI configuration. Please try again.');
      } finally {
        setConfigChecked(true);
      }
    };

    checkConfiguration();
  }, []);

  // Show loading state while checking configuration
  if (!configChecked) {
    return (
      <Layout className="ai-mode-layout">
        <Content className="flex items-center justify-center min-h-screen">
          <Space direction="vertical" align="center" size="large">
            <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 32, color: 'white' }} spin />} />
            <Text className="text-white/90 text-lg">Checking AI configuration...</Text>
          </Space>
        </Content>
      </Layout>
    );
  }

  // Show configuration error if API is not properly configured
  if (!configValid) {
    return (
      <Layout className="ai-mode-layout">
        <Content className="p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <Space direction="vertical" align="center" size="large">
                <RobotOutlined className="text-6xl text-white/60 drop-shadow-lg" />
                <Title level={2} className="text-white drop-shadow-md">
                  AI Word Lookup
                </Title>
              </Space>
            </div>

            <div className="main-search-card p-6 md:p-8">
              <Alert
                message="Configuration Required"
                description={
                  <div>
                    <p className="mb-4">{configError}</p>
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <p className="font-semibold mb-2 text-gray-800">
                        To set up AI functionality:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-gray-700">
                        <li>Create a <code className="bg-gray-200 px-2 py-1 rounded text-sm">.env</code> file in your project root</li>
                        <li>Add your Gemini API key: <code className="bg-gray-200 px-2 py-1 rounded text-sm">GEMINI_API_KEY=your_api_key_here</code></li>
                        <li>Restart the application</li>
                      </ol>
                    </div>
                    <p className="text-sm text-gray-600">
                      You can get a Gemini API key from the{' '}
                      <a 
                        href="https://makersuite.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        Google AI Studio
                      </a>
                    </p>
                  </div>
                }
                type="warning"
                showIcon
                icon={<ExclamationCircleOutlined />}
                className="mb-6"
              />
            </div>
          </div>
        </Content>
      </Layout>
    );
  }

  // Main AI mode interface
  return (
    <Layout className="ai-mode-layout">
      <Content className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Space direction="vertical" align="center" size="large">
              <div className="relative">
                <RobotOutlined className="text-6xl text-white drop-shadow-lg" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
              </div>
              <div>
                <Title level={2} className="mb-2 text-white drop-shadow-md">
                  AI Word Lookup
                </Title>
                <Text className="text-lg text-white/90 drop-shadow-sm">
                  Discover English words with AI-powered definitions and visual learning aids
                </Text>
              </div>
            </Space>
          </div>

          {/* Main search interface */}
          <div className="main-search-card p-6 md:p-8">
            <AISearchComponent className="w-full" />
          </div>

          {/* Footer info */}
          <div className="text-center mt-8">
            <Text className="text-sm text-white/80 drop-shadow-sm">
              Powered by Google Gemini AI • Enhanced learning through visual and textual content
            </Text>
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default AIMode;