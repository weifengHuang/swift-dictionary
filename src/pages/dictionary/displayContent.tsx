import { FC } from 'react';
// 引入store
import { selectedWordDefinitionAtom } from './store';
import { useAtomValue } from 'jotai';

export const DisplayContent: FC = () => {
  const wordDefinition = useAtomValue(selectedWordDefinitionAtom);
  if (!wordDefinition) {
    return null
  }
  return (
    <div>
      {wordDefinition && (
        <div dangerouslySetInnerHTML={{ __html: wordDefinition }} />
      )}
    </div>
  );
};