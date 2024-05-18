import { createRoot } from 'react-dom/client';
import WindowFrame from '@renderer/window/WindowFrame';
import { createHashRouter, RouterProvider } from 'react-router-dom';
// import Application from '@components/Application';
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
        path: '/dictionary',
        element: <DictionaryPage/>
      },
      {
        path: '/noteBook',
        element: <NoteBook />,
      },
    ],
  },
  // {
  //   path: '/notebook',
  //   element: <NoteBook />,
  // },
]);

// Application to Render
const app = (
  <WindowFrame title='ERWT Boilerplate' platform='mac'>
    <RouterProvider router={router} />
  </WindowFrame>
);

// Render application in DOM
createRoot(document.getElementById('app')).render(app);
