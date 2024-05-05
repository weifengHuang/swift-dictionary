import {
  app,
  BrowserWindow,
  globalShortcut,
  clipboard,
  ipcMain,
  dialog,
  session
} from 'electron';

import path from 'path';
import util from 'util';
import fs from 'fs'
import { registerTitlebarIpc } from '@main/window/titlebarIpc';
import { dictionary } from './dictionary';


// Electron Forge automatically creates these entry points
declare const APP_WINDOW_WEBPACK_ENTRY: string;
declare const APP_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let appWindow: BrowserWindow;

let translationWindow: BrowserWindow | null = null;


const WORD_BOOK_FILE = './wordbook.json';

async function addToWordBook(word: string) {
  const readFile = util.promisify(fs.readFile);
  const writeFile = util.promisify(fs.writeFile);

  // 检查文件是否存在，如果不存在，则创建一个空数组
  if (!fs.existsSync(WORD_BOOK_FILE)) {
    await writeFile(WORD_BOOK_FILE, JSON.stringify([]));
  }

  // 读取文件内容
  const fileContent = await readFile(WORD_BOOK_FILE, 'utf-8');
  const wordList = JSON.parse(fileContent);

  // 检查单词是否已存在于生词本中
  if (!wordList.includes(word)) {
    wordList.push(word);

    // 将更新后的内容写回文件中
    await writeFile(WORD_BOOK_FILE, JSON.stringify(wordList));
  }
}

async function setupGlobalShortcuts() {
  globalShortcut.register('CommandOrControl+SHIFT+C', async () => {
    const selectedText = clipboard.readText();
    if (selectedText) {
      const definition = await dictionary.lookup(selectedText);
      if (definition) {
        showTranslation(definition);
      }
      // 将单词添加到生词本中
      await addToWordBook(selectedText);
    }
  });
}

function showTranslation(htmlContent: string) {
  if (!translationWindow) {
    // 如果窗口不存在,创建新窗口
    translationWindow = new BrowserWindow({
      width: 400,
      height: 300,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // 当窗口关闭时,将引用设置为null
    translationWindow.on('closed', () => {
      translationWindow = null;
    });
  }

  // 加载HTML内容到窗口
  translationWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
  );

  // 显示窗口
  translationWindow.show();
}

function registerDictionaryIpc() {
  ipcMain.handle('search-words', async (_, query) => {
    return dictionary.search(query);
  });

  ipcMain.handle('lookup-word', async (_, word: string, type?:'mdd') => {
    return dictionary.lookup(word, type);
  });

  ipcMain.handle('add-book', (_, word) => {
    addToWordBook(word);
  });
  ipcMain.handle('open-file-dialog-for-dictionary', async () => {
    const {filePaths} = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{name: 'Dictionaries', extensions: ['mdx', 'mdd']}],
    })
    if (!filePaths) {
      return ;
    }
    const mdxPath = filePaths.find(filePath => path.extname(filePath).toLowerCase() === '.mdx');
    const mddPath = filePaths.find(filePath => path.extname(filePath).toLowerCase() === '.mdd');
    if (mdxPath && mddPath) {
      dictionary.updateDictionaryPaths(mdxPath, mddPath)
    } else {
      // handle error
    }
  })
}


/**
 * Create Application Window
 * @returns {BrowserWindow} Application Window Instance
 */
export function createAppWindow(): BrowserWindow {
  const filter = {
    urls: [
      'https://fengdh.github.io/mdict-js/javascripts/speex.min.js',
      'https://fengdh.github.io/mdict-js/javascripts/pcmdata.min.js',
      'https://fengdh.github.io/mdict-js/javascripts/bitstring.min.js',
      APP_WINDOW_WEBPACK_ENTRY
    ],
  };
  const csp = `script-src 'self' 'unsafe-inline' 'unsafe-eval' data: https://fengdh.github.io/mdict-js/javascripts/speex.min.js https://fengdh.github.io/mdict-js/javascripts/pcmdata.min.js https://fengdh.github.io/mdict-js/javascripts/bitstring.min.js`;

  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
  // Create new window instance
  appWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    // autoHideMenuBar: true,
    frame: false,
    // titleBarStyle: 'hidden',
    icon: path.resolve('assets/images/appIcon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      preload: APP_WINDOW_PRELOAD_WEBPACK_ENTRY,
      sandbox: false,
    },
  });
  // Load the index.html of the app window.
  appWindow.loadURL(APP_WINDOW_WEBPACK_ENTRY);

  // Show window when its ready to
  appWindow.on('ready-to-show', () => appWindow.show());

  // Register Inter Process Communication for main process
  registerMainIPC();
  setupGlobalShortcuts();
  dictionary.loadDictionary();
  // Close all windows when main window is closed
  appWindow.on('close', () => {
    appWindow = null;
    app.quit();
  });
  return appWindow;
}

/**
 * Register Inter Process Communication
 */
function registerMainIPC() {
  /**
   * Here you can assign IPC related codes for the application window
   * to Communicate asynchronously from the main process to renderer processes.
   */
  registerTitlebarIpc(appWindow);
  registerDictionaryIpc()
}
