import React, { useEffect, useState } from 'react';
import { Alert, Spin, Typography, Space } from 'antd';
import { ExclamationCircleOutlined, RobotOutlined, LoadingOutlined } from '@ant-design/icons';
import AISearchComponent from '../../components/AISearchComponent';
import { AiLookupProvider } from '@renderer/store';

const { Title, Text } = Typography;

const AIMode: React.FC = () => {
  const [configChecked, setConfigChecked] = useState(false);
  const [configValid, setConfigValid] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Check AI configuration on component mount
  useEffect(() => {
    const checkConfiguration = async () => {
      try {
        const response = await window.ipcRenderer.invoke<AIConfigCheckResponse>('check-ai-config');

        if (response?.success) {
          setConfigValid(true);
          setConfigError(null);
        } else {
          setConfigValid(false);
          setConfigError(
            response?.error?.message ||
            'AI configuration is missing. Please ensure your .env file contains the required Gemini/OpenRouter API key.'
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <Space direction="vertical" align="center" size="large">
          <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 32, color: '#3B82F6' }} spin />} />
          <Text className="text-lg text-gray-600">Checking AI configuration...</Text>
        </Space>
      </div>
    );
  }

  // Show configuration error if API is not properly configured
  if (!configValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="container mx-auto px-6 py-16">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex flex-col items-center gap-4 mb-8">
              <div className="w-16 h-16 bg-gray-400 rounded-2xl flex items-center justify-center shadow-lg">
                <RobotOutlined className="text-2xl text-white" />
              </div>
              <div className="text-center">
                <Title level={1} className="mb-1 text-gray-800 font-light">
                  AI Word Lookup
                </Title>
              </div>
            </div>
          </div>

          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8">
            <Alert
              message="Configuration Required"
              description={
                <div>
                  <p className="mb-4">{configError}</p>
                  <div className="bg-blue-50 p-4 rounded-lg mb-4">
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
            />
          </div>
        </div>
      </div>
    );
  }

  // Main AI mode interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-12 lg:py-14">
        {/* Header */}
        <div className="text-center mb-10 lg:mb-12">
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <RobotOutlined className="text-2xl text-white" />
            </div>
            <div className="text-center">
              <Title level={2} className="mb-1 text-gray-800 font-light">
                AI Word Lookup
              </Title>
              <Text className="text-base text-gray-600">
                Discover English words with intelligent definitions
              </Text>
            </div>
          </div>
        </div>

        {/* Search Interface */}
        <div className="max-w-3xl mx-auto">
          <AiLookupProvider>
            <AISearchComponent className="w-full" />
          </AiLookupProvider>
        </div>
      </div>
    </div>
  );
};

export default AIMode;
