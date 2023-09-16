import mdict, { IDictionary } from 'mdict';
import * as path from 'path';

class Dictionary {
  private dictionary: IDictionary | null = null;

  async loadDictionary() {
    const dictionaryPath = path.resolve(
      "./mdxFile/Cambridge Advanced Learner's Dictionary 4th.mdx"
    );
    this.dictionary = await mdict.dictionary(dictionaryPath);
  }

  async lookup(word: string) {
    if (!this.dictionary) {
      throw new Error('Dictionary is not loaded');
    }

    const entries = await this.dictionary.lookup(word);
    return entries;
  }

  async search(query: string) {
    if (!this.dictionary) {
      throw new Error('Dictionary is not loaded');
    }

    const results = await this.dictionary.search({
      phrase: query,
      max: 10,
    });

    return results;
  }
}

export const dictionary = new Dictionary();
