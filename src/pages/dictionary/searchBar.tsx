import { Input } from 'antd';

type SearchBarProps = {
  onSearch: (value: string) => void;
};

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => (
  <Input.Search
    placeholder="搜索单词"
    onSearch={onSearch}
    onChange={(e) => {
      onSearch(e.target.value);
    }}
    // enterButton
    style={{ width: 200 }}
  />
);
