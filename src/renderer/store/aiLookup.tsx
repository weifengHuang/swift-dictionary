import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef
} from 'react';
import type { ReactNode } from 'react';
import type { IpcRendererEvent } from 'electron';

type AiLookupStatus =
  | 'idle'
  | 'validating'
  | 'loading'
  | 'streaming'
  | 'image-loading'
  | 'ready'
  | 'error';

interface AiLookupState {
  query: string;
  status: AiLookupStatus;
  result: AISearchResult | null;
  streamText: string;
  searchError: AIError | null;
  imageError: AIError | null;
  retryCount: number;
  canRetry: boolean;
  activeRequestId: number | null;
}

const MAX_RETRIES = 3;

type StartPayload = {
  query: string;
  requestId: number;
};

type ChunkPayload = {
  requestId: number;
  text: string;
};

type CompletePayload = {
  requestId: number;
  result: Omit<AISearchResult, 'source'> & { source?: AISearchResult['source'] };
};

type ImageResolvedPayload = {
  requestId: number;
  imageUrl: string;
};

type FailPayload = {
  requestId: number | null;
  error: AIError;
};

type AiLookupAction =
  | { type: 'start'; payload: StartPayload }
  | { type: 'chunk'; payload: ChunkPayload }
  | { type: 'complete'; payload: CompletePayload }
  | { type: 'imageResolved'; payload: ImageResolvedPayload }
  | { type: 'imageFailed'; payload: FailPayload }
  | { type: 'searchFailed'; payload: FailPayload }
  | { type: 'resetError' }
  | { type: 'retryAllowed' }
  | { type: 'setQuery'; payload: string }
  | { type: 'reset' };

const initialState: AiLookupState = {
  query: '',
  status: 'idle',
  result: null,
  streamText: '',
  searchError: null,
  imageError: null,
  retryCount: 0,
  canRetry: true,
  activeRequestId: null
};

const isActive = (state: AiLookupState, requestId: number) =>
  state.activeRequestId !== null && state.activeRequestId === requestId;

function aiLookupReducer(state: AiLookupState, action: AiLookupAction): AiLookupState {
  switch (action.type) {
    case 'setQuery':
      return { ...state, query: action.payload };
    case 'start': {
      return {
        ...state,
        query: action.payload.query,
        status: 'loading',
        result: null,
        streamText: '',
        searchError: null,
        imageError: null,
        canRetry: state.retryCount < MAX_RETRIES,
        activeRequestId: action.payload.requestId
      };
    }
    case 'chunk': {
      if (!isActive(state, action.payload.requestId)) {
        return state;
      }
      return {
        ...state,
        status: 'streaming',
        streamText: action.payload.text
      };
    }
    case 'complete': {
      if (!isActive(state, action.payload.requestId)) {
        return state;
      }
      return {
        ...state,
        status: 'image-loading',
        result: {
          word: action.payload.result.word,
          definition: action.payload.result.definition,
          timestamp: action.payload.result.timestamp,
          source: action.payload.result.source ?? 'gemini'
        },
        streamText: '',
        retryCount: 0,
        canRetry: true
      };
    }
    case 'imageResolved': {
      if (!isActive(state, action.payload.requestId)) {
        return state;
      }
      if (!state.result) {
        return state;
      }
      return {
        ...state,
        status: 'ready',
        result: {
          ...state.result,
          imageUrl: action.payload.imageUrl
        },
        imageError: null,
        activeRequestId: null
      };
    }
    case 'imageFailed': {
      const { requestId, error } = action.payload;
      if (!isActive(state, requestId ?? -1)) {
        return state;
      }
      return {
        ...state,
        status: state.result ? 'ready' : 'error',
        imageError: error,
        activeRequestId: null
      };
    }
    case 'searchFailed': {
      const { requestId, error } = action.payload;
      if (requestId !== null && state.activeRequestId !== requestId) {
        return state;
      }
      const nextRetryCount = state.retryCount + 1;
      return {
        ...state,
        status: 'error',
        searchError: error,
        streamText: '',
        result: null,
        retryCount: nextRetryCount,
        canRetry: nextRetryCount < MAX_RETRIES,
        activeRequestId: null
      };
    }
    case 'resetError':
      return {
        ...state,
        searchError: null,
        imageError: null
      };
    case 'retryAllowed':
      return {
        ...state,
        retryCount: 0,
        canRetry: true
      };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

type AiLookupContextValue = {
  state: AiLookupState;
  actions: {
    setQuery: (query: string) => void;
    startLookup: (payload: StartPayload) => void;
    streamChunk: (payload: ChunkPayload) => void;
    streamComplete: (payload: CompletePayload) => void;
    imageResolved: (payload: ImageResolvedPayload) => void;
    imageFailed: (payload: FailPayload) => void;
    searchFailed: (payload: FailPayload) => void;
    reset: () => void;
    resetError: () => void;
    retryAllowed: () => void;
  };
};

const AiLookupContext = createContext<AiLookupContextValue | null>(null);

type AiLookupProviderProps = {
  children: ReactNode;
};

export const AiLookupProvider = ({ children }: AiLookupProviderProps) => {
  const [state, dispatch] = useReducer(aiLookupReducer, initialState);

  const actions = useMemo(
    () => ({
      setQuery: (query: string) => dispatch({ type: 'setQuery', payload: query }),
      startLookup: (payload: StartPayload) => dispatch({ type: 'start', payload }),
      streamChunk: (payload: ChunkPayload) => dispatch({ type: 'chunk', payload }),
      streamComplete: (payload: CompletePayload) => dispatch({ type: 'complete', payload }),
      imageResolved: (payload: ImageResolvedPayload) => dispatch({ type: 'imageResolved', payload }),
      imageFailed: (payload: FailPayload) => dispatch({ type: 'imageFailed', payload }),
      searchFailed: (payload: FailPayload) => dispatch({ type: 'searchFailed', payload }),
      reset: () => dispatch({ type: 'reset' }),
      resetError: () => dispatch({ type: 'resetError' }),
      retryAllowed: () => dispatch({ type: 'retryAllowed' })
    }),
    []
  );

  return (
    <AiLookupContext.Provider value={{ state, actions }}>
      {children}
    </AiLookupContext.Provider>
  );
};

export const useAiLookup = () => {
  const context = useContext(AiLookupContext);
  if (!context) {
    throw new Error('useAiLookup must be used within an AiLookupProvider');
  }

  const { state, actions } = context;

  const derived = useMemo(() => {
    const isLoading =
      state.status === 'loading' ||
      state.status === 'streaming' ||
      state.status === 'image-loading';
    const isStreaming = state.status === 'streaming';
    const isImageLoading = state.status === 'image-loading';

    return {
      isLoading,
      isStreaming,
      isImageLoading,
      streamText: state.streamText,
      result: state.result,
      searchError: state.searchError,
      imageError: state.imageError,
      canRetry: state.canRetry,
      query: state.query,
      status: state.status,
      activeRequestId: state.activeRequestId,
      retryCount: state.retryCount
    };
  }, [state]);

  return { state: derived, actions };
};

type LookupHandlers = {
  lookup: (word: string) => Promise<void>;
  retry: () => Promise<void>;
};

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

  const stringMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : typeof errorObject?.message === 'string'
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

type StreamHandlers = {
  cleanup: () => void;
  attach: (
    requestId: number,
    word: string,
    onChunk: (payload: StreamChunkPayload) => void,
    onComplete: (payload: StreamCompletePayload) => void,
    onError: (payload: StreamErrorPayload) => void
  ) => void;
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

const useStreamHandlers = (): StreamHandlers => {
  const handlersRef = useRef<{
    chunk?: (event: IpcRendererEvent, data: StreamChunkPayload) => void;
    complete?: (event: IpcRendererEvent, data: StreamCompletePayload) => void;
    error?: (event: IpcRendererEvent, data: StreamErrorPayload) => void;
  }>({});

  const cleanup = useCallback(() => {
    if (!window.ipcRenderer || typeof window.ipcRenderer.removeListener !== 'function') {
      return;
    }

    const handlers = handlersRef.current;
    if (handlers.chunk) {
      window.ipcRenderer.removeListener('ai-stream-chunk', handlers.chunk);
    }
    if (handlers.complete) {
      window.ipcRenderer.removeListener('ai-stream-complete', handlers.complete);
    }
    if (handlers.error) {
      window.ipcRenderer.removeListener('ai-stream-error', handlers.error);
    }

    handlersRef.current = {};
  }, []);

  const attach = useCallback(
    (
      requestId: number,
      word: string,
      onChunk: (payload: StreamChunkPayload) => void,
      onComplete: (payload: StreamCompletePayload) => void,
      onError: (payload: StreamErrorPayload) => void
    ) => {
      cleanup();

      const chunkHandler = (_event: IpcRendererEvent, data: StreamChunkPayload) => {
        if (data.word !== word) return;
        if (data.requestId && data.requestId !== requestId) return;
        onChunk({ ...data, requestId });
      };

      const completeHandler = (_event: IpcRendererEvent, data: StreamCompletePayload) => {
        if (data.word !== word) return;
        if (data.requestId && data.requestId !== requestId) return;
        cleanup();
        onComplete({ ...data, requestId });
      };

      const errorHandler = (_event: IpcRendererEvent, data: StreamErrorPayload) => {
        if (data.word !== word) return;
        if (data.requestId && data.requestId !== requestId) return;
        cleanup();
        onError({ ...data, requestId });
      };

      handlersRef.current = {
        chunk: chunkHandler,
        complete: completeHandler,
        error: errorHandler
      };

      if (window.ipcRenderer && typeof window.ipcRenderer.on === 'function') {
        window.ipcRenderer.on('ai-stream-chunk', chunkHandler);
        window.ipcRenderer.on('ai-stream-complete', completeHandler);
        window.ipcRenderer.on('ai-stream-error', errorHandler);
      }
    },
    [cleanup]
  );

  return { cleanup, attach };
};

export const useAiLookupController = (): LookupHandlers => {
  const { state, actions } = useAiLookup();
  const streamHandlers = useStreamHandlers();

  const generateImage = useCallback(
    async (word: string, definition: string, requestId: number) => {
      try {
        const response = await window.ipcRenderer.invoke<AIImageResponse>('ai-generate-image', word, definition);
        if (!response.success || !response.data?.imageUrl) {
          throw response.error ?? {
            type: AIErrorType.IMAGE_GENERATION_FAILED,
            message: 'Image generation failed'
          };
        }
        actions.imageResolved({
          requestId,
          imageUrl: response.data.imageUrl
        });
      } catch (error) {
        const parsed = parseAIError(error);
        actions.imageFailed({
          requestId,
          error: { ...parsed, type: AIErrorType.IMAGE_GENERATION_FAILED }
        });
      }
    },
    [actions]
  );

  const lookup = useCallback(
    async (word: string) => {
      const trimmed = word.trim();
      if (!trimmed) {
        actions.reset();
        return;
      }

      const requestId = Date.now();

      actions.startLookup({ query: trimmed, requestId });

      streamHandlers.attach(
        requestId,
        trimmed,
        ({ chunk }) => {
          actions.streamChunk({ requestId, text: chunk });
        },
        (payload) => {
          actions.streamComplete({
            requestId,
            result: {
              word: payload.word,
              definition: payload.definition,
              timestamp: payload.timestamp,
              source: 'gemini'
            }
          });
          void generateImage(payload.word, payload.definition, requestId);
        },
        (payload) => {
          actions.searchFailed({
            requestId,
            error: payload.error
          });
        }
      );

      try {
        await window.ipcRenderer.invoke('ai-lookup-word-stream', { word: trimmed, requestId });
      } catch (error) {
        streamHandlers.cleanup();
        const parsed = parseAIError(error);
        actions.searchFailed({
          requestId,
          error: parsed
        });
      }
    },
    [actions, generateImage, streamHandlers]
  );

  const retry = useCallback(async () => {
    if (!state.canRetry || !state.query.trim()) {
      return;
    }
    actions.retryAllowed();
    await lookup(state.query);
  }, [actions, lookup, state.canRetry, state.query]);

  return { lookup, retry };
};
