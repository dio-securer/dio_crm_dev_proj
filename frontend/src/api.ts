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
