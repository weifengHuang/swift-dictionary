import Mdict from 'js-mdict';
import Store from "electron-store";
const store = new Store<{dictionaryPath: string, dictionaryMediaPath:string}>();

class Dictionary {
  private dictionary: Mdict | null = null;
  private dictionaryMedia: Mdict | null = null;
  async loadDictionary() {
    const dictionaryPath = store.get("dictionaryPath");
    const dictionaryMediaPath = store.get("dictionaryMediaPath");
    if (!dictionaryPath || !dictionaryMediaPath) {
       return false;
    };
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
    }
    const entries = await this.dictionary.lookup(word);
    if (entries.definition) {
      return entries.definition;
    }
  }

  async search(query: string) {
    if (!this.dictionary)  {
      throw new Error('Dictionary is not loaded');
    }
    const results = await this.dictionary.prefix(query);
    return results.map(item => item.key);
  }
}

export const dictionary = new Dictionary();
``