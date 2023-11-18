import {
  app,
  BrowserWindow,
  globalShortcut,
  clipboard,
  ipcMain,
  dialog
} from 'electron';
import path from 'path';
import isDev from 'electron-is-dev';
import * as fs from 'fs';
import * as util from 'util';
import { dictionary } from './dictionary';

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
      console.log('Selected Text:', selectedText);
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
  const translationWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  translationWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`
  );
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
      // enableRemoteModule: true,
    },
  });

  win.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );
}

app.whenReady().then(() => {
  initIpcMain()
  createWindow();
  setupGlobalShortcuts();
  dictionary.loadDictionary();
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

// 初始化监听方法
function initIpcMain() {
  // 监听来自渲染进程的消息
  ipcMain.handle('search-words', async (_, query) => {
    return dictionary.search(query);
  });

  ipcMain.handle('lookup-word', async (_, word: string, type?:'mdd') => {
    return dictionary.lookup(word, type);
  });

  ipcMain.handle('add-book', (_, word) => {
    addToWordBook(word);
  });
  ipcMain.handle('open-file-dialog-for-dictionary', async (event) => {
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
