// Public (attendee) data access. Works in both hosting modes:
//
// - "server": the Node server answers /api/... with JSON.
// - "static": a static host such as GitHub Pages. There is no API, so the
//   app reads data/db.json (committed in the repo) and picks the live event
//   itself.
//
// The mode is detected once: if api/events answers with JSON, it's a server.
//
// All URLs are relative so the site also works under a sub-path
// (https://<user>.github.io/<repo>/).

import { Db } from './shared/db.js';

let modePromise = null;

export function detectMode() {
  modePromise ??= fetch('api/events', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    .then((res) => (res.ok && (res.headers.get('content-type') || '').includes('application/json') ? 'server' : 'static'))
    .catch(() => 'static'); // offline: the service worker may still serve data/db.json
  return modePromise;
}

async function getJson(url) {
  // no-cache: revalidate every time, so a GitHub Pages edit shows up as soon
  // as it is deployed instead of after the 10-minute browser cache.
  const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-cache' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function staticDb() {
  const raw = await getJson('data/db.json');
  return new Db(raw || { events: [] });
}

export async function fetchCurrentEvent() {
  if ((await detectMode()) === 'server') return getJson('api/events/current');
  return (await staticDb()).getCurrentEvent();
}

export async function fetchEvent(id) {
  if ((await detectMode()) === 'server') return getJson(`api/events/${encodeURIComponent(id)}`);
  const event = (await staticDb()).getEvent(id);
  return event && event.published ? event : null;
}
