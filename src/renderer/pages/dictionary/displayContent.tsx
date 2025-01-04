import { FC, useEffect } from 'react';
// 引入store
import { selectedTextAtom, selectedWordDefinitionAtom } from '@renderer/store';
import { useAtom, useAtomValue } from 'jotai';
import { decodeSpeex } from '../../util';
import { useSearchParams } from 'react-router-dom';

function getSoundFilename(soundUrl: string) {
  if (soundUrl.startsWith('sound://')) {
    const parts = soundUrl.split('sound://');
    return parts[1];
  } else {
    return null;
  }
}

export const DisplayContent: FC = () => {
  const [searchParams] = useSearchParams();
  const textParam = searchParams.get('text');
  const [selectedText, setSelectedText] = useAtom(selectedTextAtom);
  const wordDefinition = useAtomValue(selectedWordDefinitionAtom);
  useEffect(() => {
    if (textParam) {
      setSelectedText(textParam);
    }
  }, [textParam]);
  if (!selectedText) {
    return null;
  }
  if (!wordDefinition) {
    return `not found the definition for ${selectedText}`;
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
