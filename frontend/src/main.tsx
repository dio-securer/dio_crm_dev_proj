import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import './styles/tokens.css';
import './styles/global.css';
import './styles/workspace.css';
import './styles/ab-workspace.css';
import App from './App';
import './styles/visual-qa.css';
import './styles/visual-qa-step34.css';
import './styles/visual-qa-step56.css';
import './styles/visual-qa-microfix.css';
import './styles/visual-qa-step78.css';
import './styles/visual-qa-entity-final.css';
import './styles/visual-qa-mobile-final.css';
import './styles/design-system-v2-step1.css';
import './styles/design-system-v2-step2.css';
import './styles/design-system-v2-step3.css';
import './styles/design-system-v2-step4.css';
import './styles/design-system-v2-step5-signal.css';
import './styles/design-system-v2-step6-type-nav.css';
import { GlobalizationProvider } from './market/globalization-context';
import { registerPwa } from './pwa/register';

const client = new QueryClient();
registerPwa();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <GlobalizationProvider>
        <BrowserRouter><App /></BrowserRouter>
      </GlobalizationProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
