import { List } from 'antd';
import { useAtom } from 'jotai';
import { searchResultsAtom, selectedText } from '@renderer/store/index';
import { useLocation } from 'react-router-dom';
import { RoutesEnum } from '@renderer/constants';
import { useEffect } from 'react';

export const SearchResults: React.FC = () => {
  const { pathname } = useLocation();
  const [searchResults, setResult] = useAtom(searchResultsAtom);
  const [_, setTextValue] = useAtom(selectedText);
  useEffect(() => {
    async function readBook () {
      try {
        const noteBookDataSource =  await window.ipcRenderer.invoke<Record<string, unknown>>('read-book');
        if (noteBookDataSource) {
          const allWordList = Object.keys(noteBookDataSource);
          setResult(allWordList);
        }
      } catch (error) {
        setResult([])
      }
    }
    if (pathname === RoutesEnum.noteBook) {
      readBook();
    } else {
      setResult([])
    }
  }, [pathname]);

  const onClick = (text: string) => {
    setTextValue(text);
  };


  if (searchResults.length === 0) {
    return null;
  }

  return (
    <List
      bordered
      dataSource={searchResults}
      locale={{
        emptyText: '暂无数据',
      }}
      renderItem={(item) => (
        <List.Item
          onClick={() => {
            onClick(item);
          }}
        >
          {item}
        </List.Item>
      )}
    />
  );
};
