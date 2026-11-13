import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AccessKiosk from './AccessKiosk.jsx';
import './styles.css';

const isKiosk = window.location.pathname.replace(/\/+$/, '') === '/acceso';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>{isKiosk ? <AccessKiosk /> : <App />}</React.StrictMode>,
);