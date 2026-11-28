// One object's screens (F2-5): list, detail with related lists, create and edit, chosen by the route. The page loads
// through the EngineClient it is given and moves through the navigate callback; it knows no URL and no fetch.
import { ReactNode, useState } from 'react';
import type { UiRelated } from '@dio-crm/engine';
import type { EngineClient, EngineRoute, EngineUiModel, Failure, FieldValue, Navigate, RecordData } from './types';
import { DetailView } from './DetailView';
import { ListView } from './ListView';
import { RecordForm } from './RecordForm';
import { RelatedList } from './RelatedList';
import { FormErrors, NO_ERRORS } from './form-values';
import { viewOf } from './layout';
import { saveRecord } from './save';
import { DisplayOptions, TEXT, errorText, textOf } from './text';
import { Loaded, useLoad } from './use-load';

export interface EngineObjectPageProps { client: EngineClient; objectKey: string; locale: string; route: EngineRoute; navigate: Navigate; display?: DisplayOptions }
/** How many related rows a detail screen asks for per relation. */
export const RELATED_LIMIT = 20;

/** Loading and failure states. Before the model has arrived there are no texts yet, so a failure shows its code. */
function Pending({ loaded, model, children }: { loaded: Loaded<unknown> & { reload: () => void }; model?: EngineUiModel; children: () => ReactNode }) {
  if (loaded.state === 'loading') return <p className="engine-status" role="status" aria-busy="true">{model ? textOf(model, TEXT.loading) : ''}</p>;
  if (loaded.state === 'failed') return <FailureNote failure={loaded.failure} model={model} retry={loaded.reload} />;
  return <>{children()}</>;
}
function FailureNote({ failure, model, retry }: { failure: Failure; model?: EngineUiModel; retry: () => void }) {
  return (
    <div className="engine-banner" role="alert" data-error={failure.code}>
      <p>{model ? errorText(model, failure.code) : failure.code}</p>
      {model && <button type="button" className="engine-button" onClick={retry}>{textOf(model, TEXT.retry)}</button>}
    </div>
  );
}

function ListScreen({ client, model, route, navigate, display }: { client: EngineClient; model: EngineUiModel; route: Extract<EngineRoute, { mode: 'list' }>; navigate: Navigate; display?: DisplayOptions }) {
  const view = viewOf(model, route.view), offset = route.offset ?? 0;
  const page = useLoad(`${model.object.key}/${view?.key ?? ''}/${offset}`, () => client.list(model.object.key, { view: view?.key, offset }));
  return <Pending loaded={page} model={model}>{() => page.state === 'ready' && <ListView model={model} viewKey={view?.key} page={page.data} navigate={navigate} display={display} />}</Pending>;
}

function RelatedLoader({ client, locale, parentId, related, navigate, display }: { client: EngineClient; locale: string; parentId: string; related: UiRelated; navigate: Navigate; display?: DisplayOptions }) {
  const loaded = useLoad(`${related.object}/${related.field}/${parentId}/${locale}`, async () => {
    const child = await client.model(related.object, locale);
    return { child, page: await client.list(related.object, { ref: { field: related.field, value: parentId }, limit: RELATED_LIMIT }) };
  });
  return <Pending loaded={loaded}>{() => loaded.state === 'ready' && <RelatedList related={related} model={loaded.data.child} rows={loaded.data.page.items} navigate={navigate} display={display} />}</Pending>;
}

function DetailScreen({ client, model, locale, id, navigate, display }: { client: EngineClient; model: EngineUiModel; locale: string; id: string; navigate: Navigate; display?: DisplayOptions }) {
  const record = useLoad(`${model.object.key}/${id}`, () => client.get(model.object.key, id));
  return (
    <Pending loaded={record} model={model}>
      {() => record.state === 'ready' && (
        <DetailView model={model} record={record.data} navigate={navigate} display={display}>
          {model.related.map(r => <RelatedLoader key={`${r.object}.${r.field}`} client={client} locale={locale} parentId={record.data.id} related={r} navigate={navigate} display={display} />)}
        </DetailView>
      )}
    </Pending>
  );
}

function FormScreen({ client, model, mode, record, navigate }: { client: EngineClient; model: EngineUiModel; mode: 'create' | 'edit'; record?: RecordData; navigate: Navigate }) {
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS);
  const [busy, setBusy] = useState(false);
  const submit = async (values: Record<string, FieldValue>) => {
    // Nothing changed on an edit: there is nothing to send, so go back to the record.
    if (mode === 'edit' && Object.keys(values).length === 0) { navigate({ mode: 'detail', id: record!.id }); return; }
    setBusy(true);
    const result = await saveRecord(client, model, mode, values, record?.id);
    setBusy(false);
    if (result.ok) navigate({ mode: 'detail', id: result.record.id }); else setErrors(result.errors);
  };
  return <RecordForm model={model} mode={mode} record={record} errors={errors} busy={busy} onSubmit={submit}
    onCancel={() => navigate(record ? { mode: 'detail', id: record.id } : { mode: 'list' })} />;
}

function EditScreen({ client, model, id, navigate }: { client: EngineClient; model: EngineUiModel; id: string; navigate: Navigate }) {
  const record = useLoad(`${model.object.key}/${id}/edit`, () => client.get(model.object.key, id));
  return <Pending loaded={record} model={model}>{() => record.state === 'ready' && <FormScreen client={client} model={model} mode="edit" record={record.data} navigate={navigate} />}</Pending>;
}

export function EngineObjectPage({ client, objectKey, locale, route, navigate, display }: EngineObjectPageProps) {
  const model = useLoad(`${objectKey}/${locale}`, () => client.model(objectKey, locale));
  return (
    <div className="engine-ui" lang={locale}>
      <Pending loaded={model}>
        {() => {
          if (model.state !== 'ready') return null;
          const m = model.data;
          if (route.mode === 'list') return <ListScreen client={client} model={m} route={route} navigate={navigate} display={display} />;
          if (route.mode === 'detail') return <DetailScreen key={route.id} client={client} model={m} locale={locale} id={route.id} navigate={navigate} display={display} />;
          if (route.mode === 'create') return <FormScreen client={client} model={m} mode="create" navigate={navigate} />;
          return <EditScreen key={route.id} client={client} model={m} id={route.id} navigate={navigate} />;
        }}
      </Pending>
    </div>
  );
}
