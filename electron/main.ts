import { app, BrowserWindow, globalShortcut, clipboard } from 'electron';
import * as path from 'path';
import isDev from 'electron-is-dev';
import Mdict from 'mdict';

async function setupGlobalShortcuts() {
  const dictionary = await loadDictionary();
  globalShortcut.register('CommandOrControl+SHIFT+C', async () => {
    const selectedText = clipboard.readText();
    if (selectedText) {
      console.log('Selected Text:', selectedText);
      const entries = await dictionary.lookup(selectedText);
      if (entries.length > 0) {
        showTranslation(entries[0]);
      }
    }
  });
}

async function loadDictionary() {
  const dictionaryPath = path.resolve(`./mdxFile/Cambridge Advanced Learner's Dictionary 4th.mdx`);
  const mdict = await Mdict.dictionary(dictionaryPath);
  return mdict;
}


function showTranslation(htmlContent: string) {
  const translationWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  translationWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // enableRemoteModule: true,
    },
  });

  win.loadURL(isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../build/index.html')}`);
}

app.whenReady().then(() => {
  createWindow();
  setupGlobalShortcuts();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});


