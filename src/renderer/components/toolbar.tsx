// import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  SearchOutlined,
  BookOutlined,
  UploadOutlined,
} from '@ant-design/icons';

type IconContainerProps = React.PropsWithChildren<{ text: string }>;

const IconContainer = (props: IconContainerProps) => {
  const { children, text } = props;
  return (
    <div className='flex items-center cursor-pointer flex-col mr-2'>
      <div className='text-xl text-blue-500 mr-2'> {children}</div>
      <div className='text-xs text-gray-500'> {text}</div>
    </div>
  );
};
export const Toolbar = () => {
  const navigate = useNavigate();
  const exportOnClick = () => {
    window.ipcRenderer.invoke('open-file-dialog-for-dictionary');
  };
  const onClickNoteBook = () => {
    navigate('/notebook');
  };
  const onClickDictionary = () => {
    navigate('/dictionary');
  };

  return (
    <div className='flex'>
      <IconContainer text='词典'>
        <SearchOutlined
          onClick={onClickDictionary}
        />
      </IconContainer>
      <IconContainer text='生词本'>
        <BookOutlined
          onClick={onClickNoteBook}
        />
      </IconContainer>
      <IconContainer text='导入字典'>
        <UploadOutlined
          onClick={exportOnClick}
        />
      </IconContainer>
    </div>
  );
};
