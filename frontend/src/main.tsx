import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import App from './App';
import { GlobalizationProvider } from './market/globalization-context';

const client = new QueryClient();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <GlobalizationProvider>
        <BrowserRouter><App /></BrowserRouter>
      </GlobalizationProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
