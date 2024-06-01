import { createRoot } from 'react-dom/client';
import { RoutesEnum } from '@renderer/constants'
import { createHashRouter, RouterProvider } from 'react-router-dom';
import DictionaryPage from './pages/dictionary';
import NoteBook from './pages/notebook';
import Home from './pages/home';
import './index.scss';

// Say something
console.log('[ERWT] : Renderer execution started');

const router = createHashRouter([
  {
    path: '/',
    element: <Home />,
    children: [
      {
        path: RoutesEnum.dictionary,
        element: <DictionaryPage/>,
        index:true
      },
      {
        path: RoutesEnum.noteBook,
        element: <NoteBook />,
      },
    ],
  }
]);

// Application to Render
const app = (
    <RouterProvider router={router} />
);

// Render application in DOM
createRoot(document.getElementById('app')).render(app);
