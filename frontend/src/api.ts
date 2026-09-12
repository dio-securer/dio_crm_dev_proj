const API_BASE = ((window as unknown as { __DIO_CRM_API_BASE__?: string }).__DIO_CRM_API_BASE__ ?? '').replace(/\/$/, '');

export async function apiGet<T>(path: string): Promise<T> {
  const token = localStorage.getItem('dio_crm_access_token');
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json() as Promise<T>;
}
