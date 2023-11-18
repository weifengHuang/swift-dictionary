declare global {
  interface Window {
    ipcRenderer: {
      invoke: any;
    }
  }
}