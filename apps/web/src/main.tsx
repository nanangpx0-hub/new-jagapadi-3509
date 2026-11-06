import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/public-sans';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import 'leaflet/dist/leaflet.css';
import App from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
