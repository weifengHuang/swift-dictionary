import { atom } from 'jotai/vanilla';
import type { PrimitiveAtom, Getter, Setter } from 'jotai/vanilla';
import type { IpcRendererEvent } from 'electron';

// Existing atoms
export const searchResultsAtom: PrimitiveAtom<string[]> = atom<string[]>([]);
export const selectedTextAtom: PrimitiveAtom<string> = atom<string>('');

// AI mode related atoms
export const aiModeActiveAtom: PrimitiveAtom<boolean> = atom<boolean>(true);
export const aiSearchQueryAtom: PrimitiveAtom<string> = atom<string>('');

// AI search result interface is defined in typings/index.d.ts

// Export writable atoms directly
const initialAiSearchResult: AISearchResult | null = null;
export const aiSearchResultAtom: PrimitiveAtom<AISearchResult | null> =
  atom<AISearchResult | null>(initialAiSearchResult);
export const aiSearchLoadingAtom: PrimitiveAtom<boolean> = atom<boolean>(false);
export const aiImageLoadingAtom: PrimitiveAtom<boolean> = atom<boolean>(false);

// Error handling atoms
const initialAiError: AIError | null = null;
export const aiSearchErrorAtom: PrimitiveAtom<AIError | null> = atom<AIError | null>(initialAiError);
export const aiImageErrorAtom: PrimitiveAtom<AIError | null> = atom<AIError | null>(initialAiError);

// Streaming support atoms
export const aiStreamingAtom: PrimitiveAtom<boolean> = atom<boolean>(false);
export const aiStreamingTextAtom: PrimitiveAtom<string> = atom<string>('');
const initialActiveRequestId: number | null = null;
export const aiActiveRequestIdAtom: PrimitiveAtom<number | null> =
  atom<number | null>(initialActiveRequestId);

// Retry mechanism atoms
export const aiRetryCountAtom: PrimitiveAtom<number> = atom<number>(0);
export const aiCanRetryAtom: PrimitiveAtom<boolean> = atom<boolean>(true);

// Helper function to parse error from IPC response
const parseAIError = (error: unknown): AIError => {
  const errorObject =
    typeof error === 'object' && error !== null
      ? (error as { type?: AIErrorType; message?: unknown })
      : null;

  if (errorObject?.type && typeof errorObject.message === 'string') {
    return {
      type: errorObject.type,
      message: errorObject.message,
      details: error
    };
  }
  
  // Try to extract error information from error message
  const stringMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : typeof (errorObject?.message) === 'string'
          ? errorObject.message
          : null;

  const errorMessage = stringMessage || 'Unknown error occurred';
  
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

type StreamEventHandler<T> = (event: IpcRendererEvent, data: T) => void;

let activeStreamHandlers: {
  chunk?: StreamEventHandler<StreamChunkPayload>;
  complete?: StreamEventHandler<StreamCompletePayload>;
  error?: StreamEventHandler<StreamErrorPayload>;
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
      set(aiSearchResultAtom, null);
      set(aiSearchErrorAtom, null);
      set(aiImageErrorAtom, null);
      set(aiStreamingAtom, false);
      set(aiStreamingTextAtom, '');
      return;
    }

    const retryCount = get(aiRetryCountAtom);
    const maxRetries = 3;
    const requestId = Date.now();

    try {
      // Clear previous errors and results
      set(aiSearchErrorAtom, null);
      set(aiImageErrorAtom, null);
      set(aiSearchResultAtom, null);
      
      // Set loading and streaming states
      set(aiSearchLoadingAtom, true);
      set(aiImageLoadingAtom, true);
      set(aiStreamingAtom, true);
      set(aiStreamingTextAtom, '');
      set(aiCanRetryAtom, retryCount < maxRetries);
      set(aiActiveRequestIdAtom, requestId);

      // Clean up any previous listeners before attaching new ones
      cleanupStreamHandlers();

      const updateStreamingText = (chunk: string) => {
        set(aiStreamingTextAtom, chunk);
      };

      const finalizeStream = (definition: string, timestamp: number) => {
        const result: AISearchResult = {
          word,
          definition,
          timestamp,
          source: 'gemini'
        };

        set(aiStreamingAtom, false);
        set(aiStreamingTextAtom, '');
        set(aiSearchLoadingAtom, false);
        set(aiRetryCountAtom, 0);
        set(aiSearchResultAtom, result);
      };

      const handleStreamChunk = (_event: IpcRendererEvent, data: StreamChunkPayload) => {
        if (data.word !== word) return;

        const activeId = get(aiActiveRequestIdAtom);
        if (activeId !== requestId) return;

        if (data.requestId && data.requestId !== requestId) return;

        updateStreamingText(data.chunk);
      };

      const handleStreamComplete = (_event: IpcRendererEvent, data: StreamCompletePayload) => {
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

      const handleStreamError = (_event: IpcRendererEvent, data: StreamErrorPayload) => {
        if (data.word !== word) return;

        const activeId = get(aiActiveRequestIdAtom);
        if (activeId !== requestId) return;

        if (data.requestId && data.requestId !== requestId) return;

        cleanupStreamHandlers();
        set(aiStreamingAtom, false);
        set(aiStreamingTextAtom, '');
        set(aiSearchLoadingAtom, false);
        set(aiImageLoadingAtom, false);
        set(aiSearchErrorAtom, data.error);
        set(aiRetryCountAtom, retryCount + 1);
        set(aiCanRetryAtom, retryCount + 1 < maxRetries);
        set(aiActiveRequestIdAtom, null);
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
        set(aiActiveRequestIdAtom, null);
      }

      console.error('AI streaming word lookup failed:', error);
      
      const parsedError = parseAIError(error);
      
      set(aiSearchResultAtom, null);
      set(aiSearchLoadingAtom, false);
      set(aiImageLoadingAtom, false);
      set(aiStreamingAtom, false);
      set(aiStreamingTextAtom, '');
      set(aiSearchErrorAtom, parsedError);
      
      // Increment retry count
      set(aiRetryCountAtom, retryCount + 1);
      set(aiCanRetryAtom, retryCount + 1 < maxRetries);
    }
  }
);

// Helper function for async image generation
const generateImageAsync = async (
  get: Getter,
  set: Setter,
  params: { word: string; definition: string; requestId: number }
) => {
  const { word, definition, requestId } = params;

  try {
    const activeIdBeforeRequest = get(aiActiveRequestIdAtom);
    if (activeIdBeforeRequest !== requestId) {
      set(aiImageLoadingAtom, false);
      return;
    }

    const imageResponse = await window.ipcRenderer.invoke<AIImageResponse>('ai-generate-image', word, definition);

    const activeIdAfterRequest = get(aiActiveRequestIdAtom);
    if (activeIdAfterRequest !== requestId) {
      set(aiImageLoadingAtom, false);
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
      set(aiImageErrorAtom, null);
    } else if (imageResponse && !imageResponse.success && imageResponse.error) {
      set(aiImageErrorAtom, imageResponse.error);
    } else {
      set(aiImageErrorAtom, {
        type: AIErrorType.IMAGE_GENERATION_FAILED,
        message: 'Image generation completed but no image was returned',
        details: null
      });
    }
  } catch (imageError) {
    console.warn('Failed to generate image:', imageError);
    const parsedImageError = parseAIError(imageError);
    parsedImageError.type = AIErrorType.IMAGE_GENERATION_FAILED;
    set(aiImageErrorAtom, parsedImageError);
  } finally {
    const activeId = get(aiActiveRequestIdAtom);
    if (activeId === requestId) {
      set(aiImageLoadingAtom, false);
      set(aiActiveRequestIdAtom, null);
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
    set(aiRetryCountAtom, 0);
    set(aiActiveRequestIdAtom, null);
    await set(aiWordLookupStreamAtom, currentQuery);
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
