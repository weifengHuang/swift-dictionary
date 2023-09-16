import { List } from 'antd';
import { useAtom } from 'jotai';
import { searchResultsAtom, selectedText } from './store';

export const SearchResults: React.FC = () => {
  const [searchResults] = useAtom(searchResultsAtom);
  const [_, setTextValue] = useAtom(selectedText);
  console.log('searchResults', searchResults);
  const onClick = (text: string) => {
    setTextValue(text);
  };

  return (
    <List
      bordered
      dataSource={searchResults}
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
