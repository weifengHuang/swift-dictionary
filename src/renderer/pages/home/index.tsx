import React, { Suspense, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SearchBar } from '@components/searchBar';
import { useAtom } from 'jotai';
import { searchResultsAtom, aiModeActiveAtom } from '@renderer/store/index';
// import { DisplayContent } from '@renderer/pages/dictionary/displayContent';
import { Toolbar } from '@components/toolbar';
import TabNavigation from '@components/TabNavigation';
import { message } from 'antd';
import debounce from 'lodash.debounce';
import { RoutesEnum } from '@renderer/constants';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [_, setSearchResults] = useAtom(searchResultsAtom);
  const [aiModeActive] = useAtom(aiModeActiveAtom);
  
  const handleSearch = async (value: string) => {
    try {
      // Skip traditional dictionary search in AI mode
      if (location.pathname === RoutesEnum.aiMode) {
        return;
      }
      
      let scene 
      if (location.pathname === RoutesEnum.noteBook) {
        scene = 'noteBook'
      }
      const results = await window.ipcRenderer.invoke<unknown[]>(
        'search-words',
        value,
        scene
      );
      setSearchResults(results.map((item: unknown) => item.toString()));
    } catch (error) {
      message.error('查询字典失败，检查是否有导入词典');
    }
  };
  
  useEffect(() => {
    // Navigate to AI mode by default if aiModeActive is true, otherwise dictionary
    if (aiModeActive) {
      navigate(RoutesEnum.aiMode);
    } else {
      navigate(RoutesEnum.dictionary);
    }
  }, []);
  return (
    <div>
      {/* Tab Navigation */}
      <div className='mx-4 mt-4 mb-2'>
        <TabNavigation className="w-full" />
      </div>
      
      {/* Search Bar and Toolbar - only show for dictionary and notebook modes */}
      {location.pathname !== RoutesEnum.aiMode && (
        <div className='mx-4 mb-4 flex items-center gap-4'>
          <div className="flex-1">
            <SearchBar onSearch={debounce(handleSearch, 500)} />
          </div>
          <Toolbar />
        </div>
      )}
      
      {/* Main Content */}
      <div className={`${location.pathname === RoutesEnum.aiMode ? '' : 'mx-4 mb-4'} flex w-full`}>
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
