import React, { Suspense } from 'react';
import { SearchBar } from './searchBar';
import { SearchResults } from './searchResults';
import { useAtom } from 'jotai';
import { searchResultsAtom } from './store';
import { DisplayContent } from './displayContent';
import {Toolbar} from './toolbar';
import { message } from 'antd';
import debounce from 'lodash.debounce'

export const DictionaryPage: React.FC = () => {
  const [_, setSearchResults] = useAtom(searchResultsAtom);
  const handleSearch = async (value: string) => {
    // 这里是模拟数据，实际你需要使用真实的搜索服务
    try {
      const results = await window.ipcRenderer.invoke<unknown[]>(
        'search-words',
        value
      );
      setSearchResults(results.map((item: unknown) => item.toString()));
    } catch (error) {
       message.error('查询字典失败，检查是否有导入词典')
    }
  };
  return (
    <div className="flex">
      <div className="w-1/4 p-4">
        <SearchBar 
          onSearch={debounce(handleSearch, 500)} 
        />
        <SearchResults />
      </div>
      <div className="w-3/4 p-4">
        <Toolbar/>
        <Suspense>
          <DisplayContent />
        </Suspense>
      </div>
    </div>
  );
};
