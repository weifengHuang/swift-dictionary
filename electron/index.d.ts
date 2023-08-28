declare module 'mdict' {
  interface Mdict {
    dictionary(path: string): Promise<Dictionary>;
  }

  interface Dictionary {
    search(options: {
      phrase: string;
      max?: number;
    }): Promise<string[]>;

    lookup(word: string): Promise<string[]>; 
  }
  const mdict: Mdict;

  export = mdict;
}