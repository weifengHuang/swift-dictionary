import { FC } from 'react';
// 引入store
import { selectedWordDefinitionAtom } from './store';
import { useAtomValue } from 'jotai';
import { decodeSpeex, loadScript } from '../../util';

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
      return;
    }
    try {
      const soundBase64: string | null = await (
        window as any
      ).ipcRenderer.invoke('lookup-word', soundFilename, 'mdd');
      if (!soundBase64) {
        return;
      }
      const blob = decodeSpeex(soundBase64);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (error) {
      console.error('lookup error', error);
    }
  };
 
  return (
    <div>
      {wordDefinition && (
        <div
          dangerouslySetInnerHTML={{ __html: wordDefinition }}
          onClick={(e) => {
            const target = e.target as HTMLAnchorElement;
            if (target?.href?.startsWith('sound://')) {
              playSound(target.href);
            }
          }}
        />
      )}
    </div>
  );
};
