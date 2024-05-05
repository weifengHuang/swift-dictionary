import { createRoot } from 'react-dom/client';
import WindowFrame from '@renderer/window/WindowFrame';
// import Application from '@components/Application';
import { DictionaryPage } from './pages/dictionary';
import './index.scss'

// Say something
console.log('[ERWT] : Renderer execution started');

// Application to Render
const app = (

  <WindowFrame title='ERWT Boilerplate' platform='mac'>
      <DictionaryPage />
  </WindowFrame>
);

// Render application in DOM
createRoot(document.getElementById('app')).render(app);
