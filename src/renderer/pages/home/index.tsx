import React, { Suspense, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SearchBar } from '@components/searchBar';
import { useAtom } from 'jotai';
import { searchResultsAtom } from '@renderer/store/index';
// import { DisplayContent } from '@renderer/pages/dictionary/displayContent';
import { Toolbar } from '@components/toolbar';
import { message } from 'antd';
import debounce from 'lodash.debounce';
import { RoutesEnum } from '@renderer/constants';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [_, setSearchResults] = useAtom(searchResultsAtom);
  const handleSearch = async (value: string) => {
    try {
      const results = await window.ipcRenderer.invoke<unknown[]>(
        'search-words',
        value,
      );
      setSearchResults(results.map((item: unknown) => item.toString()));
    } catch (error) {
      message.error('查询字典失败，检查是否有导入词典');
    }
  };
  useEffect(() => {
    navigate(RoutesEnum.dictionary);
  }, []);
  return (
    <div>
      <div className='m-4 flex items-center'>
        <SearchBar onSearch={debounce(handleSearch, 500)} />
        <div className='ml-4'>
          <Toolbar />
        </div>
      </div>
      <div className='m-4 flex w-full'>
        <Suspense>
          <div className='w-full'>
            <Outlet />
          </div>
          {/* <DisplayContent /> */}
        </Suspense>
      </div>
    </div>
  );
};

export default Home;
