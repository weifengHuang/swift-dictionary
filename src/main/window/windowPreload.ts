import { contextBridge, ipcRenderer } from 'electron';
import titlebarContext from './titlebarContext';

contextBridge.exposeInMainWorld('electron_window', {
  titlebar: titlebarContext,
});

// Expose IPC renderer with proper method filtering for security
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
    // Only allow specific streaming channels for security
    const allowedChannels = [
      'ai-stream-chunk',
      'ai-stream-complete', 
      'ai-stream-error'
    ];
    if (allowedChannels.includes(channel)) {
      ipcRenderer.on(channel, listener);
    }
  },
  removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => {
    const allowedChannels = [
      'ai-stream-chunk',
      'ai-stream-complete',
      'ai-stream-error'
    ];
    if (allowedChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, listener);
    }
  },
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args)
});
