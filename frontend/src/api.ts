const API_BASE = ((window as unknown as { __DIO_CRM_API_BASE__?: string }).__DIO_CRM_API_BASE__ ?? '').replace(/\/$/, '');

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
  return parse<T>(await fetch(`${API_BASE}${path}`, { headers: headers() }));
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return parse<T>(await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: headers(true), body: body === undefined ? undefined : JSON.stringify(body)
  }));
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return parse<T>(await fetch(`${API_BASE}${path}`, {
    method: 'PATCH', headers: headers(true), body: JSON.stringify(body)
  }));
}

export async function apiDownload(path: string) {
  return parseBlob(await fetch(`${API_BASE}${path}`, { headers: headers() }));
}

export async function apiPostDownload(path: string, body: unknown) {
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
