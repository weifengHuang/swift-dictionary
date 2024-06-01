import { SearchResults } from '../../components/searchResults';
import { DisplayContent } from '../dictionary/displayContent';

const NoteBook = () => {
  return (
    <div className='flex'>
      <div className='w-1/4'>
        <SearchResults />
      </div>
      <div className='w-3/4 ml-4'>
        <DisplayContent />
      </div>
    </div>
  );
};

export default NoteBook;
