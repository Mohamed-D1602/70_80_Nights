// Public (attendee) API calls.

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export function fetchCurrentEvent() {
  return getJson('/api/events/current');
}

export function fetchEvent(id) {
  return getJson(`/api/events/${encodeURIComponent(id)}`);
}

export function fetchEvents() {
  return getJson('/api/events');
}
