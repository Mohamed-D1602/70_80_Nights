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

// One download of data/db.json is shared by the calls made during a single
// page load or refresh (site text + evening + upcoming list).
let staticPromise = null;
function staticDb() {
  if (!staticPromise) {
    staticPromise = getJson('data/db.json').then((raw) => new Db(raw || { events: [] }));
    staticPromise.finally(() => setTimeout(() => (staticPromise = null), 2000)).catch(() => {});
  }
  return staticPromise;
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

// Front-page text: group name, tagline, about the idea, founder.
export async function fetchSite() {
  if ((await detectMode()) === 'server') return getJson('api/site');
  return (await staticDb()).getSite();
}

// Summaries of all published evenings, for the "upcoming evenings" list.
export async function fetchEvents() {
  if ((await detectMode()) === 'server') return (await getJson('api/events')) || [];
  const db = await staticDb();
  const currentId = db.getSettings().currentEventId;
  return db
    .listEvents()
    .filter((e) => e.published)
    .map((e) => ({ id: e.id, title: e.title, date: e.date, venue: e.venue, songCount: e.songs.length, isCurrent: e.id === currentId }));
}
