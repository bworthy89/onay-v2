// api.ts — Stub for v2. Update API_BASE_URL and auth logic.

import { getIdToken } from './AuthService';

export const API_BASE_URL = 'https://your-api-url.com';

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getIdToken();
  if (!token) throw new Error('No auth token available');

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}
