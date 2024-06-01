import Mdict from 'js-mdict';
import Store from "electron-store";
import { getWordBook } from './appWindow';
const store = new Store<{dictionaryPath: string, dictionaryMediaPath:string}>();

class Dictionary {
  private dictionary: Mdict | null = null;
  private dictionaryMedia: Mdict | null = null;
  async loadDictionary() {
    const dictionaryPath = store.get("dictionaryPath");
    const dictionaryMediaPath = store.get("dictionaryMediaPath");
    if (!dictionaryPath || !dictionaryMediaPath) {
       return false;
    }
    this.dictionary = new Mdict(dictionaryPath);
    this.dictionaryMedia = new Mdict(dictionaryMediaPath);
  }

  updateDictionaryPaths(dictionaryPath: string, dictionaryMediaPath: string) {
    this.dictionary = new Mdict(dictionaryPath);
    store.set("dictionaryPath", dictionaryPath);
    if (dictionaryMediaPath) {
      this.dictionaryMedia = new Mdict(dictionaryMediaPath);
      store.set("dictionaryMediaPath", dictionaryMediaPath);
    }
  }

  async lookup(word: string, type?: 'mdd'): Promise<string | undefined> {
    if (!this.dictionary) {
      throw new Error('Dictionary is not loaded');
    }
    if (type ==='mdd') {
      if (!this.dictionaryMedia) {
        throw new Error('DictionaryMedia is not loaded');
      }
      const entries = await this.dictionaryMedia.lookup('\\' + word);
      if (entries.definition) {
        return entries.definition;
      }
    } else {
      const queryWord = word.toLowerCase();
      const entries = await this.dictionary.lookup(queryWord);
      if (entries.definition) {
        return entries.definition;
      }
    }
  }


  async fuzzySearchInBook(text: string): Promise<string[]> {
    const result: string[] = [];
    // TODO: 考虑一下这里的缓存机制，不每次读文件；
    const book = await getWordBook()
    const keys = Object.keys(book);
    for (const key of keys) {
      if (key.toLowerCase().includes(text.toLowerCase())) {
        result.push(key);
      }
    }
    return result;
  }

  async search(query: string, scene?: 'noteBook' | '') {
    if (scene === 'noteBook') {
      return await this.fuzzySearchInBook(query);
    }
    if (!this.dictionary)  {
      throw new Error('Dictionary is not loaded');
    }
    const results = await this.dictionary.prefix(query);
    return results.map(item => item.key);
  }
}

export const dictionary = new Dictionary();
``