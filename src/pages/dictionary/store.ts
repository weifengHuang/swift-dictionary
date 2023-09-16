import { atom } from 'jotai';

export const searchResultsAtom = atom<string[]>([]);
export const selectedText = atom<string>('');

export const selectedWordDefinitionAtom = atom(async (get) => {
  const word = get(selectedText);
  if (word) {
    const entries = await (window as any).ipcRenderer.invoke(
      'lookup-word',
      word
    );
    if (entries.length > 0) {
      return entries[0];
    }
  }
  return null;
});
