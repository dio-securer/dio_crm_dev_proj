import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import './styles/tokens.css';
import './styles/global.css';
import './styles/workspace.css';
import './styles/demo.css';
import './styles/lead-account-demo.css';
import App from './App';
import { GlobalizationProvider } from './market/globalization-context';
import { registerPwa } from './pwa/register';
import { HqMockProvider } from './hq-mock/HqMockProvider';

const client = new QueryClient();
registerPwa();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <HqMockProvider>
        <GlobalizationProvider>
          <BrowserRouter><App /></BrowserRouter>
        </GlobalizationProvider>
      </HqMockProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
