import { List } from 'antd';
import { useAtom } from 'jotai';
import { searchResultsAtom, selectedText } from '@renderer/store/index';

export const SearchResults: React.FC = () => {
  const [searchResults] = useAtom(searchResultsAtom);
  const [_, setTextValue] = useAtom(selectedText);
  const onClick = (text: string) => {
    setTextValue(text);
  };
  if (searchResults.length === 0 ) {
    return null;
  }

  return (
    <List
      bordered
      dataSource={searchResults}
      locale= {{
        emptyText: '暂无数据'
      }
      }
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
