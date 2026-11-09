import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
// Space Grotesk stays for the white-label "Grotesk" typeface option.
import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/engine.css';
import { rememberEngineHandoff } from './lib/engine';
import App from './App';

rememberEngineHandoff();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
