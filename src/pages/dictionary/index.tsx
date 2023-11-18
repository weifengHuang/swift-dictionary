import React, { Suspense } from 'react';
import { SearchBar } from './searchBar';
import { SearchResults } from './searchResults';
import { useAtom } from 'jotai';
import { searchResultsAtom } from './store';
import { DisplayContent } from './displayContent';
import {Toolbar} from './toolbar';

export const DictionaryPage: React.FC = () => {
  const [_, setSearchResults] = useAtom(searchResultsAtom);
  const handleSearch = async (value: string) => {
    // 这里是模拟数据，实际你需要使用真实的搜索服务
    const results = await (window as any).ipcRenderer.invoke(
      'search-words',
      value
    );
    setSearchResults(results.map((item: any) => item.toString()));
  };
  return (
    <div className="flex">
      <div className="w-1/4 p-4">
        <SearchBar 
          onSearch={handleSearch} 
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
