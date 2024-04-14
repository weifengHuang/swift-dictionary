import { FC } from 'react';
// 引入store
import { selectedWordDefinitionAtom } from './store';
import { useAtomValue } from 'jotai';

function base64ToBlob(base64: string) {
  debugger
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const rawData = window.atob(parts[1]);

  const uInt8Array = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    uInt8Array[i] = rawData.charCodeAt(i);
  }
  
  return new Blob([uInt8Array], {type: contentType});
}

function getSoundFilename(soundUrl: string) {
  if (soundUrl.startsWith('sound://')) {
    const parts = soundUrl.split('sound://');
    return parts[1]; 
  } else {
    return null; 
  }
}

export const DisplayContent: FC = () => {
  const wordDefinition = useAtomValue(selectedWordDefinitionAtom);
  if (!wordDefinition) {
    return null;
  }
  const playSound = async (href: string) => {
    let soundFilename = getSoundFilename(href);
    if (!playSound) {
      return
    };
    const soundBase64: string | null = await (window as any).ipcRenderer.invoke('lookup-word', soundFilename, 'mdd');
    console.log('soundBase64', soundBase64)
    if (!soundBase64) {
      return 
    };
    const blob = base64ToBlob(soundBase64);
    // const url = URL.createObjectURL(blob);
    // const audio = new Audio(url);
    // audio.play();
  }
  return (
    <div>
      {wordDefinition && (
        <div
          dangerouslySetInnerHTML={{ __html: wordDefinition }}
          onClick={(e) => {
            const target = e.target as HTMLAnchorElement
            if (target?.href?.startsWith('sound://')) {
              playSound(target.href);
            }
          }}
        />
      )}
    </div>
  );
};
