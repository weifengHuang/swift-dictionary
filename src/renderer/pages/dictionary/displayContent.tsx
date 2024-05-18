import { FC } from 'react';
// 引入store
import { selectedWordDefinitionAtom } from '@renderer/store';
import { useAtomValue } from 'jotai';
import { decodeSpeex } from '../../util';

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
    const soundFilename = getSoundFilename(href);
    if (!playSound) {
      return;
    }
    try {
      const soundBase64: string | null = await window.ipcRenderer.invoke('lookup-word', soundFilename, 'mdd');
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
            const target = e.target as HTMLElement;
            let aTagDom: HTMLAnchorElement | null = null;
            if (target instanceof HTMLAnchorElement) {
              aTagDom = target;
            } else if (target.tagName.toLowerCase() === 'img' && target.parentElement instanceof HTMLAnchorElement) {
              aTagDom = target.parentElement as HTMLAnchorElement;
            }
            if (aTagDom && aTagDom.href.startsWith('sound://')) {
              playSound(aTagDom.href);
            } else {
              console.error('not sound');
            }
          }}
        />
      )}
    </div>
  );
};
