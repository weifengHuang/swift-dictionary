import { atom } from 'jotai';

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
export const aiActiveRequestIdAtom = atom<number | null>(null);

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
      type: AIErrorType.API_KEY_MISSING,
      message: 'API key is missing or invalid. Please check your configuration.',
      details: error
    };
  }
  
  if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
    return {
      type: AIErrorType.API_RATE_LIMIT,
      message: 'API rate limit exceeded. Please try again in a few moments.',
      details: error
    };
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return {
      type: AIErrorType.API_NETWORK_ERROR,
      message: 'Network error occurred. Please check your internet connection.',
      details: error
    };
  }
  
  return {
    type: AIErrorType.API_INVALID_RESPONSE,
    message: errorMessage,
    details: error
  };
};

type StreamChunkPayload = {
  word: string;
  chunk: string;
  timestamp: number;
  requestId?: number;
};

type StreamCompletePayload = {
  word: string;
  definition: string;
  timestamp: number;
  requestId?: number;
};

type StreamErrorPayload = {
  word: string;
  error: AIError;
  timestamp: number;
  requestId?: number;
};

let activeStreamHandlers: {
  chunk?: (event: any, data: StreamChunkPayload) => void;
  complete?: (event: any, data: StreamCompletePayload) => void;
  error?: (event: any, data: StreamErrorPayload) => void;
} = {};

const cleanupStreamHandlers = () => {
  if (!window.ipcRenderer || typeof window.ipcRenderer.removeListener !== 'function') {
    return;
  }

  if (activeStreamHandlers.chunk) {
    window.ipcRenderer.removeListener('ai-stream-chunk', activeStreamHandlers.chunk);
  }
  if (activeStreamHandlers.complete) {
    window.ipcRenderer.removeListener('ai-stream-complete', activeStreamHandlers.complete);
  }
  if (activeStreamHandlers.error) {
    window.ipcRenderer.removeListener('ai-stream-error', activeStreamHandlers.error);
  }

  activeStreamHandlers = {};
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
    const requestId = Date.now();

    try {
      // Clear previous errors and results
      (set as any)(aiSearchErrorAtom, null);
      (set as any)(aiImageErrorAtom, null);
      (set as any)(aiSearchResultAtom, null);
      
      // Set loading and streaming states
      (set as any)(aiSearchLoadingAtom, true);
      (set as any)(aiImageLoadingAtom, true);
      (set as any)(aiStreamingAtom, true);
      (set as any)(aiStreamingTextAtom, '');
      (set as any)(aiCanRetryAtom, retryCount < maxRetries);
      (set as any)(aiActiveRequestIdAtom, requestId);

      // Clean up any previous listeners before attaching new ones
      cleanupStreamHandlers();

      const updateStreamingText = (chunk: string) => {
        (set as any)(aiStreamingTextAtom, chunk);
      };

      const finalizeStream = (definition: string, timestamp: number) => {
        const result: AISearchResult = {
          word,
          definition,
          timestamp,
          source: 'gemini'
        };

        (set as any)(aiStreamingAtom, false);
        (set as any)(aiStreamingTextAtom, '');
        (set as any)(aiSearchLoadingAtom, false);
        (set as any)(aiRetryCountAtom, 0);
        (set as any)(aiSearchResultAtom, result);
      };

      const handleStreamChunk = (_event: any, data: StreamChunkPayload) => {
        if (data.word !== word) return;

        const activeId = get(aiActiveRequestIdAtom);
        if (activeId !== requestId) return;

        if (data.requestId && data.requestId !== requestId) return;

        updateStreamingText(data.chunk);
      };

      const handleStreamComplete = (_event: any, data: StreamCompletePayload) => {
        if (data.word !== word) return;

        const activeId = get(aiActiveRequestIdAtom);
        if (activeId !== requestId) return;

        if (data.requestId && data.requestId !== requestId) return;

        cleanupStreamHandlers();
        finalizeStream(data.definition, data.timestamp);

        // Generate image asynchronously
        generateImageAsync(get, set, {
          word,
          definition: data.definition,
          requestId
        });
      };

      const handleStreamError = (_event: any, data: StreamErrorPayload) => {
        if (data.word !== word) return;

        const activeId = get(aiActiveRequestIdAtom);
        if (activeId !== requestId) return;

        if (data.requestId && data.requestId !== requestId) return;

        cleanupStreamHandlers();
        (set as any)(aiStreamingAtom, false);
        (set as any)(aiStreamingTextAtom, '');
        (set as any)(aiSearchLoadingAtom, false);
        (set as any)(aiImageLoadingAtom, false);
        (set as any)(aiSearchErrorAtom, data.error);
        (set as any)(aiRetryCountAtom, retryCount + 1);
        (set as any)(aiCanRetryAtom, retryCount + 1 < maxRetries);
        (set as any)(aiActiveRequestIdAtom, null);
      };

      activeStreamHandlers = {
        chunk: handleStreamChunk,
        complete: handleStreamComplete,
        error: handleStreamError
      };

      if (window.ipcRenderer && typeof window.ipcRenderer.on === 'function') {
        window.ipcRenderer.on('ai-stream-chunk', handleStreamChunk);
        window.ipcRenderer.on('ai-stream-complete', handleStreamComplete);
        window.ipcRenderer.on('ai-stream-error', handleStreamError);
      } else {
        throw new Error('IPC streaming not available - falling back to regular lookup');
      }

      // Start streaming lookup with request identifier
      await window.ipcRenderer.invoke('ai-lookup-word-stream', { word, requestId });

    } catch (error) {
      cleanupStreamHandlers();
      const activeId = get(aiActiveRequestIdAtom);
      if (activeId === requestId) {
        (set as any)(aiActiveRequestIdAtom, null);
      }

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
const generateImageAsync = async (
  get: any,
  set: any,
  params: { word: string; definition: string; requestId: number }
) => {
  const { word, definition, requestId } = params;

  try {
    const activeIdBeforeRequest = get(aiActiveRequestIdAtom);
    if (activeIdBeforeRequest !== requestId) {
      (set as any)(aiImageLoadingAtom, false);
      return;
    }

    const imageResponse = await window.ipcRenderer.invoke<AIImageResponse>('ai-generate-image', word, definition);

    const activeIdAfterRequest = get(aiActiveRequestIdAtom);
    if (activeIdAfterRequest !== requestId) {
      (set as any)(aiImageLoadingAtom, false);
      return;
    }

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
        type: AIErrorType.IMAGE_GENERATION_FAILED,
        message: 'Image generation completed but no image was returned',
        details: null
      });
    }
  } catch (imageError) {
    console.warn('Failed to generate image:', imageError);
    const parsedImageError = parseAIError(imageError);
    parsedImageError.type = AIErrorType.IMAGE_GENERATION_FAILED;
    (set as any)(aiImageErrorAtom, parsedImageError);
  } finally {
    const activeId = get(aiActiveRequestIdAtom);
    if (activeId === requestId) {
      (set as any)(aiImageLoadingAtom, false);
      (set as any)(aiActiveRequestIdAtom, null);
    }
  }
};

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
    (set as any)(aiActiveRequestIdAtom, null);
    await (set as any)(aiWordLookupStreamAtom, currentQuery);
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
