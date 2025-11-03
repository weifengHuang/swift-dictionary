import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import titlebarContext from './titlebarContext';

const STREAM_CHANNELS = ['ai-stream-chunk', 'ai-stream-complete', 'ai-stream-error'] as const;
type StreamChannel = (typeof STREAM_CHANNELS)[number];

contextBridge.exposeInMainWorld('electron_window', {
  titlebar: titlebarContext,
});

// Expose IPC renderer with proper method filtering for security
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: <T>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>,
  on: (channel: StreamChannel, listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
    if (STREAM_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, listener);
    }
  },
  removeListener: (channel: StreamChannel, listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => {
    if (STREAM_CHANNELS.includes(channel)) {
      ipcRenderer.removeListener(channel, listener);
    }
  },
  send: (channel: string, ...args: unknown[]) => ipcRenderer.send(channel, ...args)
});
