const API_BASE = ((window as unknown as { __DIO_CRM_API_BASE__?: string }).__DIO_CRM_API_BASE__ ?? '').replace(/\/$/, '');

/**
 * DEV Mock Mode is ON by default while running Vite in development.
 * Set VITE_DEV_MOCK_MODE=false when a real DEV API is available.
 * Production builds never enable this bypass.
 */
export const DEV_MOCK_MODE = import.meta.env.DEV
  && String(import.meta.env.VITE_DEV_MOCK_MODE ?? 'true').toLowerCase() !== 'false';

export class DevMockBypassError extends Error {
  readonly code = 'DEV_MOCK_BYPASS';
  readonly path: string;

  constructor(path: string) {
    super(`DEV Mock Mode bypassed HTTP transport: ${path}`);
    this.name = 'DevMockBypassError';
    this.path = path;
  }
}

function shouldBypassHttp(path: string) {
  if (!DEV_MOCK_MODE) return false;
  return /^\/api\/accounts(?:[/?]|$)/.test(path);
}

function bypassHttp<T>(path: string): Promise<T> {
  return Promise.reject(new DevMockBypassError(path));
}

function headers(json = false): HeadersInit {
  const token = localStorage.getItem('dio_crm_access_token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(json ? { 'Content-Type': 'application/json' } : {})
  };
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `API ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function parseBlob(response: Response): Promise<{ blob: Blob; filename?: string }> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `API ${response.status}`);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  return { blob: await response.blob(), filename: utf8 ? decodeURIComponent(utf8) : undefined };
}

export async function apiGet<T>(path: string): Promise<T> {
  if (shouldBypassHttp(path)) return bypassHttp<T>(path);
  return parse<T>(await fetch(`${API_BASE}${path}`, { headers: headers() }));
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  if (shouldBypassHttp(path)) return bypassHttp<T>(path);
  return parse<T>(await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: headers(true), body: body === undefined ? undefined : JSON.stringify(body)
  }));
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  if (shouldBypassHttp(path)) return bypassHttp<T>(path);
  return parse<T>(await fetch(`${API_BASE}${path}`, {
    method: 'PATCH', headers: headers(true), body: JSON.stringify(body)
  }));
}

export async function apiDownload(path: string) {
  if (shouldBypassHttp(path)) return bypassHttp<{ blob: Blob; filename?: string }>(path);
  return parseBlob(await fetch(`${API_BASE}${path}`, { headers: headers() }));
}

export async function apiPostDownload(path: string, body: unknown) {
  if (shouldBypassHttp(path)) return bypassHttp<{ blob: Blob; filename?: string }>(path);
  return parseBlob(await fetch(`${API_BASE}${path}`, { method: 'POST', headers: headers(true), body: JSON.stringify(body) }));
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
