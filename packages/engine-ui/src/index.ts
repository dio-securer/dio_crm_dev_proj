// @dio-crm/engine-ui — the generic screens of the engine (F2-5): list, detail, create / edit form and related list,
// drawn from the published metadata that the engine API serves. No screen here is written for one object.
export { EngineObjectPage, RELATED_LIMIT } from './EngineObjectPage';
export type { EngineObjectPageProps } from './EngineObjectPage';
export { ListView, RecordTable } from './ListView';
export { DetailView } from './DetailView';
export { RecordForm } from './RecordForm';
export { RelatedList } from './RelatedList';
export { saveRecord } from './save';
export { displayValue, errorText, failureOf, textOf, TEXT } from './text';
export { columnsOf, detailScreen, formScreen, placeScreen, viewOf } from './layout';
export { editableFields, fromInput, initialState, mapErrors, payloadOf, toInput, toLocalInput, NO_ERRORS } from './form-values';
export type { FormErrors, FormState, InputValue } from './form-values';
export type { EngineClient, EngineRoute, EngineUiModel, Failure, FieldError, FieldValue, ListPage, ListQuery, Navigate, RecordData } from './types';
