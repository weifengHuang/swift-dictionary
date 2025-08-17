import { createRoot } from 'react-dom/client';
import { RoutesEnum } from '@renderer/constants'
import { createHashRouter, RouterProvider } from 'react-router-dom';
import DictionaryPage from './pages/dictionary';
import NoteBook from './pages/notebook';
import Home from './pages/home';
import AIMode from './pages/ai-mode';
import ErrorBoundary from './components/ErrorBoundary';
import './index.scss';
import { DisplayContent } from './pages/dictionary/displayContent';

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
      {
        path: RoutesEnum.aiMode,
        element: <AIMode />,
      },
    ],
  },
  {
    path: '/displayContent',
    element: <DisplayContent />,
  }
]);

// Application to Render
const app = (
  <ErrorBoundary>
    <RouterProvider router={router} />
  </ErrorBoundary>
);

// Render application in DOM
createRoot(document.getElementById('app')).render(app);
