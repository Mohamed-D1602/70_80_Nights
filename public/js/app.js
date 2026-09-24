// Attendee app entry point: loads the current event and routes between the
// song list (#/) and the lyrics viewer (#/song/<songId>).
//
// Routes are hash-based so any static host works and deep links survive
// reloads. To add pages later (e.g. #/events for past events, #/search),
// add a branch in route().

import { fetchCurrentEvent } from './api.js';
import { h } from './dom.js';
import { applyPrefs } from './prefs.js';
import { renderSongList } from './components/songList.js';
import { renderLyricsViewer } from './components/lyricsViewer.js';

const REFRESH_MS = 60 * 1000;
const app = document.getElementById('app');

let event = null;
let cleanup = () => {};
let lastRoute = null;

applyPrefs();

function parseRoute() {
  const m = location.hash.match(/^#\/song\/([^/?]+)/);
  return m ? { name: 'song', songId: decodeURIComponent(m[1]) } : { name: 'list' };
}

function route({ keepScroll = false } = {}) {
  const r = parseRoute();
  const routeKey = JSON.stringify(r);
  const scrollY = window.scrollY;
  cleanup();

  if (!event) {
    cleanup = () => {};
    return;
  }

  if (r.name === 'song') {
    const index = event.songs.findIndex((s) => s.id === r.songId);
    if (index === -1) {
      location.replace('#/');
      return;
    }
    cleanup = renderLyricsViewer(app, event, index, {
      goTo: (i) => {
        location.hash = `#/song/${encodeURIComponent(event.songs[i].id)}`;
      },
      goHome: () => {
        location.hash = '#/';
      },
    });
  } else {
    cleanup = renderSongList(app, event);
  }

  // Same page re-rendered after a data refresh → stay where the user was.
  window.scrollTo(0, keepScroll && routeKey === lastRoute ? scrollY : 0);
  lastRoute = routeKey;
}

function showMessage(title, text) {
  app.replaceChildren(h('div', { class: 'page page-message' }, h('h1', {}, title), h('p', {}, text)));
}

async function load({ silent = false } = {}) {
  try {
    const fresh = await fetchCurrentEvent();
    if (!fresh) {
      event = null;
      showMessage('لا توجد فعالية حالياً', 'سيتم نشر قائمة أغاني الليلة قريباً. حاول مرة أخرى لاحقاً.');
      return;
    }
    // Only re-render when something actually changed (admin edited a song).
    const changed = !event || JSON.stringify(fresh) !== JSON.stringify(event);
    event = fresh;
    if (changed) route({ keepScroll: silent });
  } catch {
    if (!silent && !event) {
      showMessage('تعذّر التحميل', 'تحقق من اتصالك بالإنترنت ثم أعد تحميل الصفحة.');
    }
  }
}

window.addEventListener('hashchange', () => route());

// Pick up last-minute edits from the admin without a manual reload.
setInterval(() => document.visibilityState === 'visible' && load({ silent: true }), REFRESH_MS);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && load({ silent: true }));

load();

// Offline support: cache the app + lyrics so a patchy venue connection
// doesn't break the night.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
