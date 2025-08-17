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
import { GeminiService, GeminiError } from './geminiService';
import log from 'electron-log/main'

// Electron Forge automatically creates these entry points
declare const APP_WINDOW_WEBPACK_ENTRY: string;
declare const APP_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let appWindow: BrowserWindow;

let translationWindow: BrowserWindow | null = null;

// Initialize Gemini service for AI functionality
let geminiService: GeminiService | null = null;

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
 * Initialize AI services and perform startup checks
 */
async function initializeAIServices() {
  try {
    log.info('Initializing AI services...');
    
    if (geminiService) {
      // Test the configuration and connection
      const configCheck = geminiService.validateConfiguration();
      if (configCheck.isValid) {
        log.info('AI service configuration is valid');
        
        // Test connection in background (don't block startup)
        geminiService.testConnection()
          .then(result => {
            if (result.success) {
              log.info('AI service connection test successful');
            } else {
              log.warn('AI service connection test failed:', result.error);
            }
          })
          .catch(error => {
            log.warn('AI service connection test error:', error);
          });
      } else {
        log.warn('AI service configuration issues:', configCheck.errors);
      }
    } else {
      log.warn('AI service not initialized - check your .env configuration');
    }
    
  } catch (error) {
    log.error('Error during AI services initialization:', error);
  }
}

/**
 * Cleanup AI services on application shutdown
 */
function cleanupAIServices() {
  try {
    log.info('Cleaning up AI services...');
    
    if (geminiService) {
      // Perform any necessary cleanup
      geminiService = null;
      log.info('AI services cleaned up successfully');
    }
    
  } catch (error) {
    log.error('Error during AI services cleanup:', error);
  }
}

/**
 * Register AI-related IPC handlers for Gemini API integration
 */
function registerAIIpc() {
  // Initialize Gemini service
  try {
    geminiService = new GeminiService();
    log.info('GeminiService initialized successfully');
  } catch (error) {
    log.error('Failed to initialize GeminiService:', error);
    geminiService = null;
  }

  /**
   * Handle AI word lookup requests
   * Returns comprehensive word definition using Gemini API
   */
  ipcMain.handle('ai-lookup-word', async (_, word: string) => {
    try {
      if (!geminiService) {
        throw new Error('Gemini service is not available. Please check your API configuration.');
      }

      log.info(`AI word lookup requested for: ${word}`);
      
      // Validate the word input
      const validation = geminiService.validateWord(word);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid word provided');
      }

      // Get word definition from Gemini API
      const definition = await geminiService.getWordDefinition(word);
      
      log.info(`AI word lookup completed for: ${word}`);
      return {
        success: true,
        data: {
          word,
          definition,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      log.error(`AI word lookup failed for "${word}":`, error);
      
      let errorMessage = 'An unexpected error occurred';
      let errorType = 'UNKNOWN_ERROR';

      if (error instanceof GeminiError) {
        errorMessage = error.message;
        errorType = error.type;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: {
          type: errorType,
          message: errorMessage,
          word
        }
      };
    }
  });

  /**
   * Handle AI image generation requests
   * Generates educational images for words using Gemini API
   */
  ipcMain.handle('ai-generate-image', async (_, word: string, definition?: string) => {
    try {
      if (!geminiService) {
        throw new Error('Gemini service is not available. Please check your API configuration.');
      }

      log.info(`AI image generation requested for: ${word}`);
      
      // Validate the word input
      const validation = geminiService.validateWord(word);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid word provided');
      }

      // Generate image using Gemini API
      const imageUrl = await geminiService.generateWordImage(word, definition);
      
      log.info(`AI image generation completed for: ${word}`);
      return {
        success: true,
        data: {
          word,
          imageUrl,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      log.error(`AI image generation failed for "${word}":`, error);
      
      let errorMessage = 'Failed to generate image';
      let errorType = 'IMAGE_GENERATION_FAILED';

      if (error instanceof GeminiError) {
        errorMessage = error.message;
        errorType = error.type;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: {
          type: errorType,
          message: errorMessage,
          word
        }
      };
    }
  });

  /**
   * Handle AI configuration check requests
   * Validates Gemini API configuration and connectivity
   */
  ipcMain.handle('check-ai-config', async () => {
    try {
      if (!geminiService) {
        return {
          success: false,
          error: {
            type: 'SERVICE_NOT_INITIALIZED',
            message: 'Gemini service is not initialized. Please check your API configuration.'
          }
        };
      }

      log.info('Checking AI configuration...');
      
      // Check if service is configured
      const isConfigured = geminiService.isConfigured();
      if (!isConfigured) {
        const validation = geminiService.validateConfiguration();
        return {
          success: false,
          error: {
            type: 'CONFIGURATION_ERROR',
            message: 'AI service configuration is invalid',
            details: validation.errors
          }
        };
      }

      // Test API connection
      const connectionTest = await geminiService.testConnection();
      if (!connectionTest.success) {
        return {
          success: false,
          error: {
            type: 'CONNECTION_ERROR',
            message: connectionTest.error || 'Failed to connect to Gemini API'
          }
        };
      }

      // Get configuration details (without sensitive data)
      const config = geminiService.getConfiguration();
      
      log.info('AI configuration check completed successfully');
      return {
        success: true,
        data: {
          isConfigured: true,
          isConnected: true,
          configuration: config,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      log.error('AI configuration check failed:', error);
      
      let errorMessage = 'Configuration check failed';
      let errorType = 'CONFIGURATION_CHECK_FAILED';

      if (error instanceof GeminiError) {
        errorMessage = error.message;
        errorType = error.type;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: {
          type: errorType,
          message: errorMessage
        }
      };
    }
  });

  /**
   * Handle combined AI word lookup with image generation
   * Returns both definition and image for a word
   */
  ipcMain.handle('ai-lookup-word-with-image', async (_, word: string) => {
    try {
      if (!geminiService) {
        throw new Error('Gemini service is not available. Please check your API configuration.');
      }

      log.info(`AI word lookup with image requested for: ${word}`);
      
      // Validate the word input
      const validation = geminiService.validateWord(word);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid word provided');
      }

      // Get both definition and image
      const result = await geminiService.getWordDefinitionWithImage(word);
      
      log.info(`AI word lookup with image completed for: ${word}`);
      return {
        success: true,
        data: {
          word,
          definition: result.definition,
          imageUrl: result.imageUrl,
          timestamp: Date.now()
        }
      };

    } catch (error) {
      log.error(`AI word lookup with image failed for "${word}":`, error);
      
      let errorMessage = 'An unexpected error occurred';
      let errorType = 'UNKNOWN_ERROR';

      if (error instanceof GeminiError) {
        errorMessage = error.message;
        errorType = error.type;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: {
          type: errorType,
          message: errorMessage,
          word
        }
      };
    }
  });
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
  
  // Initialize AI services
  initializeAIServices();
  // Close all windows when main window is closed
  appWindow.on('close', () => {
    // Cleanup AI services
    cleanupAIServices();
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
  registerDictionaryIpc();
  registerAIIpc();
}
