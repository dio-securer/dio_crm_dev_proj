import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import './styles/tokens.css';
import './styles/global.css';
import './styles/workspace.css';
import App from './App';
import AdminMockApp from './admin/AdminMockApp';
import { executionMode } from '@dio-crm/contracts/admin';
const mode = executionMode(import.meta.env.VITE_CRM_EXECUTION_MODE, import.meta.env.PROD);
import { GlobalizationProvider } from './market/globalization-context';
import { registerPwa } from './pwa/register';

const client = new QueryClient();
registerPwa();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <GlobalizationProvider>
        <BrowserRouter>{mode === 'LEGACY' ? <App /> : <AdminMockApp mode={mode as 'API_MOCK'|'BROWSER_MOCK'} />}</BrowserRouter>
      </GlobalizationProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
