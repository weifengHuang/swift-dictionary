import React, { useState, useCallback, useEffect } from 'react';
import { Input, Button, Space, Typography, Spin, Alert, Row, Col, Progress, Card, message } from 'antd';
import { SearchOutlined, LoadingOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { useAtom } from 'jotai';
import { 
  aiSearchQueryAtom, 
  aiSearchResultAtom, 
  aiSearchLoadingAtom,
  aiImageLoadingAtom,
  aiWordLookupAtom,
  aiSearchErrorAtom,
  aiImageErrorAtom,
  aiRetryLookupAtom,
  aiCanRetryAtom
} from '../store';
import debounce from 'lodash.debounce';
import WordDefinitionDisplay from './WordDefinitionDisplay';
import AIImageDisplay from './AIImageDisplay';

const { Title } = Typography;

interface AISearchComponentProps {
  className?: string;
}

export const AISearchComponent: React.FC<AISearchComponentProps> = ({ className }) => {
  const [searchQuery, setSearchQuery] = useAtom(aiSearchQueryAtom);
  const [searchResult] = useAtom(aiSearchResultAtom);
  const [isLoading] = useAtom(aiSearchLoadingAtom);
  const [isImageLoading] = useAtom(aiImageLoadingAtom);
  const [searchError] = useAtom(aiSearchErrorAtom);
  const [imageError] = useAtom(aiImageErrorAtom);
  const [canRetry] = useAtom(aiCanRetryAtom);
  const [, performLookup] = useAtom(aiWordLookupAtom);
  const [, performRetry] = useAtom(aiRetryLookupAtom);
  
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [inputError, setInputError] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState<boolean>(false);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setInputError(null);
        return;
      }

      // Validate input - only allow English letters and basic punctuation
      const englishWordPattern = /^[a-zA-Z\s\-']+$/;
      if (!englishWordPattern.test(query.trim())) {
        setInputError('Please enter English words only');
        return;
      }

      // Check word length
      if (query.trim().length > 100) {
        setInputError('Word is too long (maximum 100 characters)');
        return;
      }

      try {
        setInputError(null);
        setShowSuccessMessage(false);
        setSearchQuery(query.trim());
        await performLookup(query.trim());
      } catch (err) {
        console.error('Search error:', err);
        setInputError('Failed to search. Please try again.');
      }
    }, 500),
    [performLookup, setSearchQuery]
  );

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);
    debouncedSearch(value);
  }, [debouncedSearch]);

  // Handle manual search button click
  const handleSearch = useCallback(async () => {
    if (!localQuery.trim()) return;
    
    try {
      setInputError(null);
      setShowSuccessMessage(false);
      setSearchQuery(localQuery.trim());
      await performLookup(localQuery.trim());
    } catch (err) {
      console.error('Manual search error:', err);
      setInputError('Failed to search. Please try again.');
    }
  }, [localQuery, performLookup, setSearchQuery]);

  // Handle Enter key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  // Show success message when search completes successfully
  useEffect(() => {
    if (searchResult && !isLoading && !searchError) {
      setShowSuccessMessage(true);
      
      // Show success toast notification
      message.success({
        content: `Successfully found definition for "${searchResult.word}"`,
        duration: 3,
        key: 'search-success'
      });
      
      // Hide success message after 3 seconds
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [searchResult, isLoading, searchError]);

  // Show error toast notifications
  useEffect(() => {
    if (searchError && !isLoading) {
      message.error({
        content: `Search failed: ${searchError.message}`,
        duration: 5,
        key: 'search-error'
      });
    }
  }, [searchError, isLoading]);

  // Show image generation notifications
  useEffect(() => {
    if (imageError && !isImageLoading) {
      message.warning({
        content: 'Image generation failed, but definition is available',
        duration: 4,
        key: 'image-error'
      });
    } else if (searchResult?.imageUrl && !isImageLoading && !imageError) {
      message.success({
        content: 'Visual aid generated successfully!',
        duration: 2,
        key: 'image-success'
      });
    }
  }, [imageError, isImageLoading, searchResult?.imageUrl]);

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  return (
    <div className={`ai-search-component ${className || ''}`}>
      <div className="mb-8">
        <div className="max-w-2xl mx-auto">
          <Space.Compact style={{ width: '100%' }} size="large" className="search-input-group">
          <Input
            placeholder="Enter an English word to search..."
            value={localQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            size="large"
            disabled={isLoading}
            className="search-input"
            autoFocus
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={isLoading}
            size="large"
            disabled={!localQuery.trim()}
            className="search-button"
          >
            Search
          </Button>
        </Space.Compact>
        </div>

        {inputError && (
          <Alert
            message="Input Error"
            description={inputError}
            type="error"
            showIcon
            className="mt-3"
            closable
            onClose={() => setInputError(null)}
          />
        )}

        {searchError && (
          <Alert
            message="Search Error"
            description={searchError.message}
            type="error"
            showIcon
            className="mt-3"
            action={
              canRetry && (
                <Button size="small" onClick={() => performRetry()}>
                  Retry
                </Button>
              )
            }
            closable
          />
        )}

        {showSuccessMessage && searchResult && !isLoading && (
          <Alert
            message="Search Completed Successfully!"
            description={`Found comprehensive definition and visual aid for "${searchResult.word}"`}
            type="success"
            showIcon
            className="mt-3"
            closable
            onClose={() => setShowSuccessMessage(false)}
          />
        )}
      </div>

      {/* Enhanced Loading state */}
      {isLoading && (
        <Card className="loading-card mb-8">
          <div className="loading-content">
            <div className="mb-6">
              <Spin 
                size="large" 
                indicator={<LoadingOutlined style={{ fontSize: 32, color: '#667eea' }} spin />}
              />
            </div>
            
            <Typography.Title level={4} className="mb-3 text-gray-700">
              Searching for "{searchQuery}"
            </Typography.Title>
            
            <div className="loading-progress mb-6">
              <Progress 
                percent={isImageLoading ? 50 : 90} 
                status="active"
                strokeColor={{
                  '0%': '#667eea',
                  '100%': '#764ba2',
                }}
                showInfo={false}
                className="max-w-md mx-auto"
              />
            </div>
            
            <div className="loading-steps">
              <div className="step-item">
                {!isImageLoading ? (
                  <CheckCircleOutlined className="text-green-500" />
                ) : (
                  <SyncOutlined spin className="text-blue-500" />
                )}
                <span>Getting word definition...</span>
              </div>
              
              <div className="step-item">
                {isImageLoading ? (
                  <SyncOutlined spin className="text-blue-500" />
                ) : (
                  <CheckCircleOutlined className="text-green-500" />
                )}
                <span>Generating visual aid...</span>
              </div>
            </div>
            
            <div className="mt-4 text-sm text-gray-500">
              This may take a few seconds...
            </div>
          </div>
        </Card>
      )}

      {/* Search results */}
      {searchResult && !isLoading && (
        <div className="search-results-container">
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <WordDefinitionDisplay
                definition={searchResult.definition}
                word={searchResult.word}
                timestamp={searchResult.timestamp}
                loading={false}
                error={searchError}
                onRetry={() => performLookup(searchResult.word)}
                className="h-full"
              />
            </Col>
            <Col xs={24} lg={12}>
              <AIImageDisplay
                imageUrl={searchResult.imageUrl}
                word={searchResult.word}
                loading={isImageLoading}
                error={imageError}
                onRetry={() => performLookup(searchResult.word)}
                className="h-full"
              />
            </Col>
          </Row>
        </div>
      )}

      {/* No results state */}
      {!searchResult && !isLoading && searchQuery && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <SearchOutlined style={{ fontSize: 48 }} />
          </div>
          <div className="text-xl text-gray-600 mb-2">No results found</div>
          <div className="text-gray-500">Try searching for a different English word</div>
        </div>
      )}
    </div>
  );
};

export default AISearchComponent;