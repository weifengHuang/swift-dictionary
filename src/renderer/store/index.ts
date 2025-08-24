import { atom } from 'jotai';

// Import AI error type
declare const AIErrorType: typeof window extends { AIErrorType: infer T } ? T : {
  API_KEY_MISSING: 'API_KEY_MISSING';
  API_RATE_LIMIT: 'API_RATE_LIMIT'; 
  API_NETWORK_ERROR: 'API_NETWORK_ERROR';
  API_INVALID_RESPONSE: 'API_INVALID_RESPONSE';
  IMAGE_GENERATION_FAILED: 'IMAGE_GENERATION_FAILED';
};

// Use the enum values directly since it's globally available
const AI_ERROR_TYPES = {
  API_KEY_MISSING: 'API_KEY_MISSING' as const,
  API_RATE_LIMIT: 'API_RATE_LIMIT' as const,
  API_NETWORK_ERROR: 'API_NETWORK_ERROR' as const,
  API_INVALID_RESPONSE: 'API_INVALID_RESPONSE' as const,
  IMAGE_GENERATION_FAILED: 'IMAGE_GENERATION_FAILED' as const,
};

// Existing atoms
export const searchResultsAtom = atom<string[]>([]);
export const selectedTextAtom = atom<string>('');

// AI mode related atoms
export const aiModeActiveAtom = atom<boolean>(true);
export const aiSearchQueryAtom = atom<string>('');

// AI search result interface is defined in typings/index.d.ts

// Export writable atoms directly
export const aiSearchResultAtom = atom<AISearchResult | null>(null);
export const aiSearchLoadingAtom = atom<boolean>(false);
export const aiImageLoadingAtom = atom<boolean>(false);

// Error handling atoms
export const aiSearchErrorAtom = atom<AIError | null>(null);
export const aiImageErrorAtom = atom<AIError | null>(null);

// Streaming support atoms
export const aiStreamingAtom = atom<boolean>(false);
export const aiStreamingTextAtom = atom<string>('');

// Retry mechanism atoms
export const aiRetryCountAtom = atom<number>(0);
export const aiCanRetryAtom = atom<boolean>(true);

// Helper function to parse error from IPC response
const parseAIError = (error: any): AIError => {
  if (error && typeof error === 'object' && error.type && error.message) {
    return error as AIError;
  }
  
  // Try to extract error information from error message
  const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
  
  if (errorMessage.includes('API key') || errorMessage.includes('API_KEY')) {
    return {
      type: AI_ERROR_TYPES.API_KEY_MISSING,
      message: 'API key is missing or invalid. Please check your configuration.',
      details: error
    };
  }
  
  if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
    return {
      type: AI_ERROR_TYPES.API_RATE_LIMIT,
      message: 'API rate limit exceeded. Please try again in a few moments.',
      details: error
    };
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return {
      type: AI_ERROR_TYPES.API_NETWORK_ERROR,
      message: 'Network error occurred. Please check your internet connection.',
      details: error
    };
  }
  
  return {
    type: AI_ERROR_TYPES.API_INVALID_RESPONSE,
    message: errorMessage,
    details: error
  };
};

// Async atom for AI word lookup with streaming support
export const aiWordLookupStreamAtom = atom(
  null,
  async (get, set, word: string) => {
    if (!word.trim()) {
      (set as any)(aiSearchResultAtom, null);
      (set as any)(aiSearchErrorAtom, null);
      (set as any)(aiImageErrorAtom, null);
      (set as any)(aiStreamingAtom, false);
      (set as any)(aiStreamingTextAtom, '');
      return;
    }

    const retryCount = get(aiRetryCountAtom);
    const maxRetries = 3;

    try {
      // Clear previous errors and results
      (set as any)(aiSearchErrorAtom, null);
      (set as any)(aiImageErrorAtom, null);
      (set as any)(aiSearchResultAtom, null);
      
      // Set loading and streaming states
      (set as any)(aiSearchLoadingAtom, false); // Set to false immediately for streaming
      (set as any)(aiImageLoadingAtom, true);
      (set as any)(aiStreamingAtom, true);
      (set as any)(aiStreamingTextAtom, '');
      (set as any)(aiCanRetryAtom, retryCount < maxRetries);

      // Set up IPC event listeners for streaming
      const handleStreamChunk = (event: any, data: { word: string, chunk: string, timestamp: number }) => {
        if (data.word === word) {
          (set as any)(aiStreamingTextAtom, data.chunk);
        }
      };

      const handleStreamComplete = (event: any, data: { word: string, definition: string, timestamp: number }) => {
        if (data.word === word) {
          (set as any)(aiStreamingAtom, false);
          (set as any)(aiStreamingTextAtom, '');
          (set as any)(aiSearchLoadingAtom, false);
          (set as any)(aiRetryCountAtom, 0);

          const result: AISearchResult = {
            word,
            definition: data.definition,
            timestamp: data.timestamp,
            source: 'gemini'
          };

          (set as any)(aiSearchResultAtom, result);

          // Clean up listeners
          if (window.ipcRenderer && typeof window.ipcRenderer.removeListener === 'function') {
            window.ipcRenderer.removeListener('ai-stream-chunk', handleStreamChunk);
            window.ipcRenderer.removeListener('ai-stream-complete', handleStreamComplete);
            window.ipcRenderer.removeListener('ai-stream-error', handleStreamError);
          }

          // Generate image asynchronously
          generateImageAsync(set, word, data.definition);
        }
      };

      const handleStreamError = (event: any, data: { word: string, error: AIError, timestamp: number }) => {
        if (data.word === word) {
          (set as any)(aiStreamingAtom, false);
          (set as any)(aiStreamingTextAtom, '');
          (set as any)(aiSearchLoadingAtom, false);
          (set as any)(aiImageLoadingAtom, false);
          (set as any)(aiSearchErrorAtom, data.error);
          (set as any)(aiRetryCountAtom, retryCount + 1);
          (set as any)(aiCanRetryAtom, retryCount + 1 < maxRetries);

          // Clean up listeners
          if (window.ipcRenderer && typeof window.ipcRenderer.removeListener === 'function') {
            window.ipcRenderer.removeListener('ai-stream-chunk', handleStreamChunk);
            window.ipcRenderer.removeListener('ai-stream-complete', handleStreamComplete);
            window.ipcRenderer.removeListener('ai-stream-error', handleStreamError);
          }
        }
      };

      // Register event listeners
      if (window.ipcRenderer && typeof window.ipcRenderer.on === 'function') {
        window.ipcRenderer.on('ai-stream-chunk', handleStreamChunk);
        window.ipcRenderer.on('ai-stream-complete', handleStreamComplete);
        window.ipcRenderer.on('ai-stream-error', handleStreamError);

        // Start streaming lookup
        await window.ipcRenderer.invoke('ai-lookup-word-stream', word);
      } else {
        throw new Error('IPC streaming not available - falling back to regular lookup');
      }

    } catch (error) {
      console.error('AI streaming word lookup failed:', error);
      
      const parsedError = parseAIError(error);
      
      (set as any)(aiSearchResultAtom, null);
      (set as any)(aiSearchLoadingAtom, false);
      (set as any)(aiImageLoadingAtom, false);
      (set as any)(aiStreamingAtom, false);
      (set as any)(aiStreamingTextAtom, '');
      (set as any)(aiSearchErrorAtom, parsedError);
      
      // Increment retry count
      (set as any)(aiRetryCountAtom, retryCount + 1);
      (set as any)(aiCanRetryAtom, retryCount + 1 < maxRetries);
    }
  }
);

// Helper function for async image generation
const generateImageAsync = async (set: any, word: string, definition: string) => {
  try {
    const imageResponse = await window.ipcRenderer.invoke<AIImageResponse>('ai-generate-image', word, definition);

    if (imageResponse && imageResponse.success && imageResponse.data && imageResponse.data.imageUrl) {
      // Get current result and update with image
      set(aiSearchResultAtom, (current: AISearchResult | null) => {
        if (current && current.word === word) {
          return { ...current, imageUrl: imageResponse.data.imageUrl };
        }
        return current;
      });
      (set as any)(aiImageErrorAtom, null);
    } else if (imageResponse && !imageResponse.success && imageResponse.error) {
      (set as any)(aiImageErrorAtom, imageResponse.error);
    } else {
      (set as any)(aiImageErrorAtom, {
        type: AI_ERROR_TYPES.IMAGE_GENERATION_FAILED,
        message: 'Image generation completed but no image was returned',
        details: null
      });
    }
  } catch (imageError) {
    console.warn('Failed to generate image:', imageError);
    const parsedImageError = parseAIError(imageError);
    parsedImageError.type = AI_ERROR_TYPES.IMAGE_GENERATION_FAILED;
    (set as any)(aiImageErrorAtom, parsedImageError);
  } finally {
    (set as any)(aiImageLoadingAtom, false);
  }
};

// Async atom for AI word lookup with enhanced error handling
export const aiWordLookupAtom = atom(
  null,
  async (get, set, word: string) => {
    if (!word.trim()) {
      (set as any)(aiSearchResultAtom, null);
      (set as any)(aiSearchErrorAtom, null);
      (set as any)(aiImageErrorAtom, null);
      return;
    }

    const retryCount = get(aiRetryCountAtom);
    const maxRetries = 3;

    try {
      // Clear previous errors
      (set as any)(aiSearchErrorAtom, null);
      (set as any)(aiImageErrorAtom, null);
      
      // Set loading states
      (set as any)(aiSearchLoadingAtom, true);
      (set as any)(aiImageLoadingAtom, true);
      (set as any)(aiCanRetryAtom, retryCount < maxRetries);

      // Call AI lookup word API
      const response = await window.ipcRenderer.invoke<AILookupResponse>('ai-lookup-word', word);

      if (response && response.success && response.data && response.data.definition) {
        const definition = response.data.definition;
        const result: AISearchResult = {
          word,
          definition,
          timestamp: Date.now(),
          source: 'gemini'
        };

        // Set the text result first
        (set as any)(aiSearchResultAtom, result);
        (set as any)(aiSearchLoadingAtom, false);
        (set as any)(aiRetryCountAtom, 0); // Reset retry count on success

        // Generate image asynchronously
        try {
          const imageResponse = await window.ipcRenderer.invoke<AIImageResponse>('ai-generate-image', word, definition);

          if (imageResponse && imageResponse.success && imageResponse.data && imageResponse.data.imageUrl) {
            // Update result with image
            (set as any)(aiSearchResultAtom, { ...result, imageUrl: imageResponse.data.imageUrl });
            (set as any)(aiImageErrorAtom, null);
          } else if (imageResponse && !imageResponse.success && imageResponse.error) {
            // Handle structured error response
            (set as any)(aiImageErrorAtom, imageResponse.error);
          } else {
            // Image generation returned empty result
            (set as any)(aiImageErrorAtom, {
              type: AI_ERROR_TYPES.IMAGE_GENERATION_FAILED,
              message: 'Image generation completed but no image was returned',
              details: null
            });
          }
        } catch (imageError) {
          console.warn('Failed to generate image:', imageError);
          const parsedImageError = parseAIError(imageError);
          parsedImageError.type = AI_ERROR_TYPES.IMAGE_GENERATION_FAILED;
          (set as any)(aiImageErrorAtom, parsedImageError);
        } finally {
          (set as any)(aiImageLoadingAtom, false);
        }
      } else if (response && !response.success && response.error) {
        // Handle structured error response from IPC
        (set as any)(aiSearchResultAtom, null);
        (set as any)(aiSearchLoadingAtom, false);
        (set as any)(aiImageLoadingAtom, false);
        (set as any)(aiSearchErrorAtom, response.error);
        
        // Increment retry count
        (set as any)(aiRetryCountAtom, retryCount + 1);
        (set as any)(aiCanRetryAtom, retryCount + 1 < maxRetries);
      } else {
        // Definition lookup returned empty result
        (set as any)(aiSearchResultAtom, null);
        (set as any)(aiSearchLoadingAtom, false);
        (set as any)(aiImageLoadingAtom, false);
        (set as any)(aiSearchErrorAtom, {
          type: AI_ERROR_TYPES.API_INVALID_RESPONSE,
          message: 'No definition found for this word',
          details: null
        });
      }
    } catch (error) {
      console.error('AI word lookup failed:', error);
      
      const parsedError = parseAIError(error);
      
      (set as any)(aiSearchResultAtom, null);
      (set as any)(aiSearchLoadingAtom, false);
      (set as any)(aiImageLoadingAtom, false);
      (set as any)(aiSearchErrorAtom, parsedError);
      
      // Increment retry count
      (set as any)(aiRetryCountAtom, retryCount + 1);
      (set as any)(aiCanRetryAtom, retryCount + 1 < maxRetries);
    }
  }
);

// Retry atom for manual retry functionality
export const aiRetryLookupAtom = atom(
  null,
  async (get, set) => {
    const currentQuery = get(aiSearchQueryAtom);
    const retryCount = get(aiRetryCountAtom);
    
    if (!currentQuery.trim() || retryCount >= 3) {
      return;
    }
    
    // Reset retry count and perform lookup
    (set as any)(aiRetryCountAtom, 0);
    await (set as any)(aiWordLookupAtom, currentQuery);
  }
);

function extractSrcValue(srcString: string): string {
  const match = srcString.match(/src="(.*?)"/);
  return match ? match[1] : "";
}

async function processImage(srcString: string): Promise<string> {
  const imagePath = extractSrcValue(srcString);
  const imageBase64 = await window.ipcRenderer.invoke('lookup-word', `${imagePath}`, 'mdd');
  return srcString.replace(imagePath, `data:image/png;base64,${imageBase64}`);
}

async function processDefinition(definition: string): Promise<string> {
  const matches = definition.match(/src="(.*?)"/g);
  if (matches) {
    for (const match of matches) {
      const newStr = await processImage(match);
      definition = definition.replace(match, newStr);
    }
  }
  // definition = definition.replace(/<a href="(.*?)">/g, (match, href) => {
  //   if (href.startsWith('sound://')) {
  //     return `<a href="${href}" onClick="widow.playSound('${href}')">`;
  //   } else {
  //     return match;
  //   }
  // });
  return definition;
}


export const selectedWordDefinitionAtom = atom(async (get) => {
  const word = get(selectedTextAtom);
  if (word) {
    const definition = await window.ipcRenderer.invoke<string>(
      'lookup-word',
      word
    );
    if (definition) {
      // 这里如果查到则写到生词本；
      window.ipcRenderer.invoke('add-book', word);
      return processDefinition(definition);
    }
  }
  return null;
});
