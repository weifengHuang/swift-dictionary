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

interface Window {
  ipcRenderer: {
    invoke:<T>(channel: string, ...args: unknown[]) => Promise<T>;
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
