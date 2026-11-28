// The route entry of the generic engine screens (F2-5). It only connects: the URL to a route, the shared API client to
// the engine API, the app's language to the model. Every screen is drawn by @dio-crm/engine-ui from published metadata.
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EngineObjectPage } from '@dio-crm/engine-ui';
import type { EngineClient } from '@dio-crm/engine-ui';
import '@dio-crm/engine-ui/engine-ui.css';
import { apiGet, apiPatch, apiPost } from '../api';
import { normalizeLocale, DEFAULT_LOCALE } from '../i18n/locale-resolver';
import { engineApi, enginePath, parseEngineRoute } from './engine-route';

const client: EngineClient = {
  model: (object, locale) => apiGet(engineApi.model(object, locale)),
  list: (object, query) => apiGet(engineApi.records(object, query)),
  get: (object, id) => apiGet(engineApi.record(object, id)),
  create: (object, values) => apiPost(engineApi.records(object), values),
  update: (object, id, values) => apiPatch(engineApi.record(object, id), values),
};

export function EngineScreen() {
  const params = useParams(), [search] = useSearchParams(), go = useNavigate(), { i18n } = useTranslation();
  const object = params.object ?? '', route = parseEngineRoute(params['*'] ?? '', search);
  if (!/^[a-z][a-z0-9_]{0,99}$/.test(object) || !route) return <main role="alert">ENGINE_SCREEN_NOT_FOUND</main>;
  return (
    <main>
      <EngineObjectPage client={client} objectKey={object} locale={normalizeLocale(i18n.language) ?? DEFAULT_LOCALE} route={route}
        navigate={(next, other) => go(enginePath(other ?? object, next))} />
    </main>
  );
}
