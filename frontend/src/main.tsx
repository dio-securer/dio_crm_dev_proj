import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import './styles/tokens.css';
import './styles/global.css';
import './styles/workspace.css';
import App from './App';
import { executionMode } from '@dio-crm/contracts/admin';
import { MockEntry } from './admin/MockEntry';
const mode = executionMode(import.meta.env.VITE_CRM_EXECUTION_MODE, import.meta.env.PROD);

import { GlobalizationProvider } from './market/globalization-context';
import { registerPwa } from './pwa/register';

const client = new QueryClient();
if (mode === 'LEGACY') registerPwa();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      {mode === 'LEGACY' ? <GlobalizationProvider><BrowserRouter><App /></BrowserRouter></GlobalizationProvider> : <MockEntry mode={mode as 'API_MOCK'|'BROWSER_MOCK'} />}
    </QueryClientProvider>
  </React.StrictMode>
);
