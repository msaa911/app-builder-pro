import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);
