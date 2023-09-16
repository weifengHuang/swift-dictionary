import { Input } from 'antd';

type SearchBarProps = {
  onSearch: (value: string) => void;
};

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => (
  <Input.Search
    placeholder="搜索单词"
    onSearch={onSearch}
    enterButton
    style={{ width: 200, margin: '0 10px' }}
  />
);
