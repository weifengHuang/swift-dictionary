import React from 'react';
import { Alert, Button, Space } from 'antd';
import { ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <Alert
            message="Something went wrong"
            description={
              <div>
                <p className="mb-4">
                  An unexpected error occurred while rendering this component.
                </p>
                {this.state.error && (
                  <details className="mb-4">
                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                      Error details
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
                <Space>
                  <Button 
                    type="primary" 
                    icon={<ReloadOutlined />} 
                    onClick={this.handleRetry}
                  >
                    Try Again
                  </Button>
                  <Button onClick={() => window.location.reload()}>
                    Reload Page
                  </Button>
                </Space>
              </div>
            }
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;