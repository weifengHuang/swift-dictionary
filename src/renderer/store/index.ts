import { atom } from 'jotai/vanilla';
import type { PrimitiveAtom } from 'jotai/vanilla';

export { AiLookupProvider, useAiLookup, useAiLookupController } from './aiLookup';

export const searchResultsAtom: PrimitiveAtom<string[]> = atom<string[]>([]);
export const selectedTextAtom: PrimitiveAtom<string> = atom<string>('');
export const aiModeActiveAtom: PrimitiveAtom<boolean> = atom<boolean>(true);

function extractSrcValue(srcString: string): string {
  const match = srcString.match(/src="(.*?)"/);
  return match ? match[1] : '';
}

async function processImage(srcString: string): Promise<string> {
  const imagePath = extractSrcValue(srcString);
  const imageBase64 = await window.ipcRenderer.invoke('lookup-word', `${imagePath}`, 'mdd');
  return srcString.replace(imagePath, `data:image/png;base64,${imageBase64}`);
}

async function processDefinition(definition: string): Promise<string> {
  const matches = definition.match(/src="(.*?)"/g);
  if (matches) {
    for (const match of matches) {
      const newStr = await processImage(match);
      definition = definition.replace(match, newStr);
    }
  }
  return definition;
}

export const selectedWordDefinitionAtom = atom(async (get) => {
  const word = get(selectedTextAtom);
  if (word) {
    const definition = await window.ipcRenderer.invoke<string>('lookup-word', word);
    if (definition) {
      window.ipcRenderer.invoke('add-book', word);
      return processDefinition(definition);
    }
  }
  return null;
});

