// Admin API client. The login token is kept in localStorage so a page reload
// during event prep doesn't log you out (tokens expire after 12 hours).

const TOKEN_KEY = 'nights.adminToken';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class AuthError extends Error {}

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api/admin${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && path !== '/login') {
    setToken(null);
    throw new AuthError('Your session expired. Please log in again.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function login(password) {
  const { token } = await request('POST', '/login', { password });
  setToken(token);
}

export function logout() {
  setToken(null);
}

export const getState = () => request('GET', '/state');
export const createEvent = (fields) => request('POST', '/events', fields);
export const updateEvent = (id, fields) => request('PUT', `/events/${id}`, fields);
export const deleteEvent = (id) => request('DELETE', `/events/${id}`);
export const setCurrentEvent = (eventId) => request('PUT', '/settings/current-event', { eventId });
export const addSong = (eventId, fields) => request('POST', `/events/${eventId}/songs`, fields);
export const updateSong = (eventId, songId, fields) => request('PUT', `/events/${eventId}/songs/${songId}`, fields);
export const deleteSong = (eventId, songId) => request('DELETE', `/events/${eventId}/songs/${songId}`);
export const reorderSongs = (eventId, songIds) => request('PUT', `/events/${eventId}/songs/order`, { songIds });
export const exportBackup = () => request('GET', '/export');
export const importBackup = (data) => request('POST', '/import', data);
