// Attendee app entry point: loads the site text and the current evening, and
// routes between the home page (#/) and a program segment (#/song/<id>).
//
// Routes are hash-based so any static host works and deep links survive
// reloads. To add pages later (e.g. #/events for past evenings, #/search),
// add a branch in route().

import { fetchCurrentEvent, fetchEvents, fetchSite } from './api.js';
import { h } from './dom.js';
import { applyPrefs } from './prefs.js';
import { DEFAULT_SITE } from './shared/db.js';
import { renderSongList } from './components/songList.js';
import { renderLyricsViewer } from './components/lyricsViewer.js';

const REFRESH_MS = 60 * 1000;
const app = document.getElementById('app');

let data = null; // { site, event, upcoming }
let cleanup = () => {};
let shown = null; // what is on screen: { routeKey, viewKey }

applyPrefs();

function parseRoute() {
  const m = location.hash.match(/^#\/song\/([^/?]+)/);
  return m ? { name: 'song', songId: decodeURIComponent(m[1]) } : { name: 'home' };
}

// Evenings after today, other than the current one, soonest first.
function upcomingFrom(events, currentId) {
  const today = new Date().toISOString().slice(0, 10);
  return events
    .filter((e) => !e.isCurrent && e.id !== currentId && e.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// The data a view actually displays. A background refresh re-renders only if
// this changed, so a playing video isn't restarted by an unrelated edit.
function viewKey(r) {
  if (r.name === 'song') {
    const songs = data.event ? data.event.songs : [];
    return JSON.stringify([songs.find((s) => s.id === r.songId), songs.map((s) => [s.id, s.title]), data.event?.title]);
  }
  return JSON.stringify([data.site, data.event, data.upcoming]);
}

function route({ refresh = false } = {}) {
  if (!data) return;
  const r = parseRoute();
  const routeKey = JSON.stringify(r);
  const key = viewKey(r);
  if (refresh && shown && shown.routeKey === routeKey && shown.viewKey === key) return;

  const scrollY = window.scrollY;
  cleanup();
  cleanup = () => {};

  const event = data.event;
  if (r.name === 'song') {
    const index = event ? event.songs.findIndex((s) => s.id === r.songId) : -1;
    if (index === -1) {
      location.replace('#/');
      return;
    }
    cleanup = renderLyricsViewer(app, event, index, {
      siteName: data.site.name,
      goTo: (i) => {
        location.hash = `#/song/${encodeURIComponent(event.songs[i].id)}`;
      },
      goHome: () => {
        location.hash = '#/';
      },
    });
  } else {
    cleanup = renderSongList(app, data);
  }

  // Same page re-rendered after a data refresh → stay where the user was.
  window.scrollTo(0, refresh && shown && shown.routeKey === routeKey ? scrollY : 0);
  shown = { routeKey, viewKey: key };
}

function showMessage(title, text) {
  app.replaceChildren(h('div', { class: 'page page-message' }, h('h1', {}, title), h('p', {}, text)));
}

async function load({ refresh = false } = {}) {
  try {
    const [site, event, events] = await Promise.all([fetchSite(), fetchCurrentEvent(), fetchEvents()]);
    data = { site: site || DEFAULT_SITE, event, upcoming: upcomingFrom(events, event && event.id) };
    route({ refresh });
  } catch {
    if (!data) showMessage('تعذّر التحميل', 'تحقق من اتصالك بالإنترنت ثم أعد تحميل الصفحة.');
  }
}

window.addEventListener('hashchange', () => route());

// Pick up last-minute edits from the admin without a manual reload.
setInterval(() => document.visibilityState === 'visible' && load({ refresh: true }), REFRESH_MS);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && load({ refresh: true }));

load();

// Offline support: cache the app so a patchy venue connection doesn't break
// the evening (videos themselves still need the internet).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
