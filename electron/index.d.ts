declare module 'mdict' {
  interface Mdict {
    dictionary(path: string): Promise<IDictionary>;
  }

  export interface IDictionary {
    search(options: {
      phrase: string;
      max?: number;
    }): Promise<string[]>;

    lookup(word: string): Promise<string[]>; 
  }
  const mdict: Mdict;

  export default mdict;
}