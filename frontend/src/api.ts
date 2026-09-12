const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export async function apiGet<T>(path: string): Promise<T> {
  const token = localStorage.getItem('dio_crm_access_token');
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json() as Promise<T>;
}
