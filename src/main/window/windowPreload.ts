import { contextBridge, ipcRenderer } from 'electron';
import titlebarContext from './titlebarContext';

contextBridge.exposeInMainWorld('electron_window', {
  titlebar: titlebarContext,
});
contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer);
