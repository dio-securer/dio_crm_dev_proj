import { getHqScenario, getHqToken, hqApiPath, isHqMockMode, isVisualPreviewMode } from './hq-mock/mode';
import { visualPreviewResponse } from './customization/visual-preview-fixture';

const API_BASE = (typeof window === 'undefined' ? '' : (window as unknown as { __DIO_CRM_API_BASE__?: string }).__DIO_CRM_API_BASE__ ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  readonly statusCode: number;
  readonly errorCode?: string;
  readonly details?: unknown;
  constructor(message: string, statusCode: number, errorCode?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

function headers(json = false): HeadersInit {
  const hq = isHqMockMode();
  const token = hq ? getHqToken() : localStorage.getItem('dio_crm_access_token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(hq ? { 'X-HQ-Mode': 'HQ_HTTP_MOCK', 'X-HQ-Scenario': getHqScenario() } : {})
  };
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  if (isVisualPreviewMode()) return visualPreviewResponse(path, init);
  const hq = isHqMockMode();
  const response = await fetch(hq ? hqApiPath(path) : `${API_BASE}${path}`, {
    ...init,
    ...(hq ? { credentials: 'omit', redirect: 'error' } as const : {})
  });
  if (hq && response.headers.get('X-HQ-Mock') !== 'true') {
    throw new ApiError('HQ mock server was not confirmed. The request will not be retried against another server.', 502, 'HQ_MOCK_NOT_CONFIRMED');
  }
  return response;
}

async function responseError(response: Response): Promise<ApiError> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as { message?: unknown; error?: unknown; details?: unknown; code?: string };
    const message = Array.isArray(body.message) ? body.message.join(', ')
      : typeof body.message === 'string' ? body.message
      : typeof body.error === 'string' ? body.error : text;
    return new ApiError(message || `API ${response.status}`, response.status,
      body.code ?? (typeof body.error === 'string' ? body.error : undefined), body.details);
  } catch { return new ApiError(text || `API ${response.status}`, response.status); }
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function parseBlob(response: Response): Promise<{ blob: Blob; filename?: string }> {
  if (!response.ok) throw await responseError(response);
  const disposition = response.headers.get('content-disposition') ?? '';
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  return { blob: await response.blob(), filename: utf8 ? decodeURIComponent(utf8) : undefined };
}

export async function apiGet<T>(path: string): Promise<T> {
  return parse<T>(await request(path, { headers: headers() }));
}

export interface ConfigurationContext {releaseId:string;permissionVersion:number}
export async function apiAdminCommand<T>(path:string,method:'POST'|'PATCH'|'PUT',body:unknown,key:string,revision?:number):Promise<T>{
 if(isHqMockMode())throw new ApiError('Managed administration requires an authenticated managed session.',409,'HQ_MANAGED_RUNTIME_REQUIRED');
 return parse<T>(await request(path,{method,headers:{...headers(true),'Idempotency-Key':key,...(revision===undefined?{}:{'If-Match':'"'+revision+'"'})},body:JSON.stringify(body)}));
}
export async function apiGetConfigured<T>(path:string,expected?:ConfigurationContext):Promise<{data:T;context:ConfigurationContext|null}>{
 const response=await request(path,{headers:{...headers(),...(expected?{'X-Config-Release-Id':expected.releaseId,'X-Config-Permission-Version':String(expected.permissionVersion)}:{})}});const data=await parse<T>(response);
 const releaseId=response.headers.get('X-Config-Release-Id'),version=response.headers.get('X-Config-Permission-Version');
 if(!releaseId&&!version)return {data,context:null};
 if(!releaseId||!version||!Number.isSafeInteger(Number(version))||Number(version)<1)throw new ApiError('Invalid configuration context',502,'INVALID_CONFIG_CONTEXT');
 return {data,context:{releaseId,permissionVersion:Number(version)}};
}
export async function apiConfiguredCommand<T>(path:string,method:'POST'|'PATCH'|'DELETE',body:unknown,context:ConfigurationContext,key:string):Promise<T>{
 return parse<T>(await request(path,{method,headers:{...headers(true),'X-Config-Release-Id':context.releaseId,'X-Config-Permission-Version':String(context.permissionVersion),'Idempotency-Key':key},body:JSON.stringify(body)}));
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return parse<T>(await request(path, {
    method: 'POST', headers: headers(true), body: body === undefined ? undefined : JSON.stringify(body)
  }));
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return parse<T>(await request(path, {
    method: 'PATCH', headers: headers(true), body: JSON.stringify(body)
  }));
}

export async function apiDelete<T = { success: boolean }>(path: string, body?: unknown): Promise<T> {
  return parse<T>(await request(path, {
    method: 'DELETE', headers: headers(body !== undefined),
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  }));
}

export async function apiDownload(path: string) {
  return parseBlob(await request(path, { headers: headers() }));
}

export async function apiPostDownload(path: string, body: unknown) {
  return parseBlob(await request(path, { method: 'POST', headers: headers(true), body: JSON.stringify(body) }));
}
export async function apiConfiguredDownload(path:string,method:'GET'|'POST',body:unknown,context:ConfigurationContext,key?:string){
 const response=await request(path,{method,headers:{...headers(method==='POST'),'X-Config-Release-Id':context.releaseId,'X-Config-Permission-Version':String(context.permissionVersion),...(key?{'Idempotency-Key':key}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw await responseError(response);
 if(response.headers.get('X-Config-Release-Id')!==context.releaseId||Number(response.headers.get('X-Config-Permission-Version'))!==context.permissionVersion)throw new ApiError('Configuration changed during export',409,'CONFIG_CHANGED');
 const type=response.headers.get('Content-Type')??'';if(!['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].some(t=>type.startsWith(t)))throw new ApiError('Invalid export response',502,'INVALID_EXPORT_RESPONSE');
 return {blob:await response.blob(),locale:response.headers.get('X-DIO-Export-Locale')};
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
