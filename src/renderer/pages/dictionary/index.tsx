import React, { Suspense } from 'react';
import { SearchResults } from './searchResults';
import { DisplayContent } from './displayContent';
// import {Toolbar} from '../../components/toolbar';
// import { message } from 'antd';
// import debounce from 'lodash.debounce'

const DictionaryPage: React.FC = () => {
  // const [_, setSearchResults] = useAtom(searchResultsAtom);
  return (
    <div className='flex'>
      <div className="w-1/4">
        <SearchResults />
      </div>
      <div className="w-3/4 ml-4">
        <Suspense>
          <DisplayContent />
        </Suspense>
      </div>
    </div>
  );
};

export default DictionaryPage