declare module '*.css';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';

type OggFrameData = ArrayBuffer;
type SpeexBitstream = Uint8Array;
type SpeexSegments = number[];
interface WavData extends ArrayBuffer {}

interface SpeexHeader {
  mode: number;
  rate: number;
  nb_channels: number;
}

type IpcChanel = 'open-file-dialog-for-dictionary' | 'add-book' | 'read-book' | 'search-words' | 'lookup-word' | 'ai-lookup-word' | 'ai-generate-image' | 'check-ai-config' | 'ai-lookup-word-with-image' | 'ai-lookup-word-stream'

interface Window {
  ipcRenderer: {
    invoke:<T>(channel: IpcChanel, ...args: unknown[]) => Promise<T>;
    on(channel: string, listener: (event: any, ...args: any[]) => void): void;
    removeListener(channel: string, listener: (event: any, ...args: any[]) => void): void;
    send(channel: string, ...args: any[]): void;
  };
  SpeexComment: unknown;

  Ogg: {
    new (fileString: string, options?: { file: boolean }): {
      demux(): void;
      frames: OggFrameData[];
      bitstream(): SpeexBitstream;
      segments: SpeexSegments;
    };
  };
  Speex: {
    new (options: { quality: number; mode: number; rate: number }): {
      decode(bitstream: SpeexBitstream, segments: SpeexSegments): Float32Array;
    };
    parseHeader(frameData: OggFrameData): SpeexHeader;
    util: {
      str2ab(data: ArrayBuffer): WavData;
    };
  };

  PCMData: {
    encode(options: {
      sampleRate: number;
      channelCount: number;
      bytesPerSample: number;
      data: Float32Array;
    }): ArrayBuffer;
  };
}

// AI-related type definitions
interface AISearchResult {
  word: string;
  definition: string;
  imageUrl?: string;
  timestamp: number;
  source: 'gemini';
}

interface AIConfig {
  geminiApiKey: string;
  geminiTextModel: string;
  geminiImageModel: string;
  geminiApiBaseUrl: string;
}

enum AIErrorType {
  API_KEY_MISSING = 'API_KEY_MISSING',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_NETWORK_ERROR = 'API_NETWORK_ERROR',
  API_INVALID_RESPONSE = 'API_INVALID_RESPONSE',
  IMAGE_GENERATION_FAILED = 'IMAGE_GENERATION_FAILED'
}

interface AIError {
  type: AIErrorType;
  message: string;
  details?: any;
}

interface GeminiTextResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

interface GeminiImageResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        inlineData: {
          mimeType: string;
          data: string; // base64
        };
      }>;
    };
  }>;
}

// IPC Response types
interface AILookupResponse {
  success: boolean;
  data?: {
    word: string;
    definition: string;
    timestamp: number;
  };
  error?: AIError;
}

interface AIImageResponse {
  success: boolean;
  data?: {
    word: string;
    imageUrl: string;
    timestamp: number;
  };
  error?: AIError;
}

interface AIConfigCheckResponse {
  success: boolean;
  data?: {
    isConfigured: boolean;
    isConnected: boolean;
    configuration: any;
    timestamp: number;
  };
  error?: AIError;
}

interface AILookupWithImageResponse {
  success: boolean;
  data?: {
    word: string;
    definition: string;
    imageUrl: string;
    timestamp: number;
  };
  error?: AIError;
}
