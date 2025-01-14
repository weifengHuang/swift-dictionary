import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  dialog,
  session
} from 'electron';

import path from 'path';
import util from 'util';
import fs from 'fs'
import { registerTitlebarIpc } from '@main/window/titlebarIpc';
import { getSelectedText } from 'node-get-selected-text'
import { getAuthStatus, askForAccessibilityAccess } from 'node-mac-permissions'
import { dictionary } from './dictionary';
import log from 'electron-log/main'

// Electron Forge automatically creates these entry points
declare const APP_WINDOW_WEBPACK_ENTRY: string;
declare const APP_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let appWindow: BrowserWindow;

let translationWindow: BrowserWindow | null = null;


const WORD_BOOK_FILE = './wordbook.json';

async function addToWordBook(word: string) {
  const writeFile = util.promisify(fs.writeFile);
  // 检查文件是否存在，如果不存在，则创建一个空数组
  if (!fs.existsSync(WORD_BOOK_FILE)) {
    await writeFile(WORD_BOOK_FILE, JSON.stringify([]));
  }
  const wordBook = await getWordBook();
  // 检查单词是否已存在于生词本中
  if (!(word in wordBook)) {
    wordBook[word] = {
      createAt: Date.now()
    }
    // 将更新后的内容写回文件中
    await writeFile(WORD_BOOK_FILE, JSON.stringify(wordBook));
  }
}

export async  function getWordBook () {
  const readFile = util.promisify(fs.readFile);
  const fileContent = await readFile(WORD_BOOK_FILE, 'utf-8');
  const wordBook: Record<string, object> = JSON.parse(fileContent);
  return wordBook

}

async function setupGlobalShortcuts() {
  // TODO: 可配置快捷键
  globalShortcut.register('CommandOrControl+SHIFT+C', async () => {
    let status = await getAuthStatus('accessibility')
    if (status !== 'authorized') {
      let inputMonitorAccess  = await askForAccessibilityAccess();
      if (inputMonitorAccess !== 'authorized') {
        log.info('not authorized')
        return ;
      }
    }
    log.info("getAuthStatus", status);
    const selectedText = getSelectedText();
    log.info("getSelectedText", selectedText);
    if (selectedText) {
      showTranslation(selectedText);
      // 将单词添加到生词本中
      addToWordBook(selectedText);
    }
  });
}

function showTranslation(selectedText: string) {
  if (!translationWindow) {
    // 如果窗口不存在,创建新窗口
    translationWindow = new BrowserWindow({
      width: 400,
      height: 300,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
        preload: APP_WINDOW_PRELOAD_WEBPACK_ENTRY,
        sandbox: false,
      },
    });

    // 当窗口关闭时,将引用设置为null
    translationWindow.on('closed', () => {
      translationWindow = null;
    });
  }

  translationWindow.loadURL(`${APP_WINDOW_WEBPACK_ENTRY}#/displayContent?text=${selectedText}`);


  // 显示窗口
  translationWindow.show();
}

function registerDictionaryIpc() {
  ipcMain.handle('search-words', async (_, query, scene: 'noteBook' | '') => {
      return dictionary.search(query, scene);
  });

  ipcMain.handle('lookup-word', async (_, word: string, type?:'mdd') => {
    return dictionary.lookup(word, type);
  });

  ipcMain.handle('add-book', (_, word) => {
    addToWordBook(word);
  });
  ipcMain.handle('read-book', () => {
    return getWordBook();
  })
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
      dictionary.updateDictionaryPaths(mdxPath, mddPath);
      dialog.showMessageBox({
        type: 'info',
        title: '导入成功',
        message: '字典已成功导入',
        buttons: ['确定'],
        icon: null
      });
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
