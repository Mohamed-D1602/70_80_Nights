// Admin app entry point: holds the state, wires actions to the API and
// re-renders the panels after every change.

import { h } from '../dom.js';
import * as api from './adminApi.js';
import { renderLoginForm } from './loginForm.js';
import { EventPanel } from './eventPanel.js';
import { SongsPanel } from './songsPanel.js';
import { SongEditor } from './songEditor.js';

const root = document.getElementById('admin');
const toastEl = document.getElementById('toast');

let state = null; // { settings, events }
let selectedEventId = null;
let selectedSongId = null; // song id, 'new', or null
let editor = null; // current SongEditor (for unsaved-changes checks)

// ---------- helpers ----------

let toastTimer;
function toast(message, kind = 'ok') {
  toastEl.textContent = message;
  toastEl.className = `toast toast-${kind}`;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), kind === 'error' ? 6000 : 2500);
}

function confirmDiscard() {
  return !(editor && editor.isDirty()) || confirm('You have unsaved changes to this song. Discard them?');
}

window.addEventListener('beforeunload', (e) => {
  if (editor && editor.isDirty()) e.preventDefault();
});

// Runs an API call, shows the result, refreshes state. Returns the call's
// result, or undefined if it failed.
async function run(fn, successMessage) {
  try {
    const result = await fn();
    if (successMessage) toast(successMessage);
    await refresh();
    return result;
  } catch (err) {
    if (err instanceof api.AuthError) {
      editor = null;
      showLogin();
    }
    toast(err.message, 'error');
    return undefined;
  }
}

async function refresh() {
  state = await api.getState();
  const { events, settings } = state;
  if (!events.some((e) => e.id === selectedEventId)) {
    selectedEventId = settings.currentEventId || (events[0] && events[0].id) || null;
  }
  const event = events.find((e) => e.id === selectedEventId);
  if (selectedSongId !== 'new' && !(event && event.songs.some((s) => s.id === selectedSongId))) {
    selectedSongId = null;
  }
  render();
}

// ---------- actions (called by the panels) ----------

const actions = {
  selectEvent(id) {
    if (!confirmDiscard()) return render();
    selectedEventId = id;
    selectedSongId = null;
    render();
  },

  selectSong(id) {
    if (id === selectedSongId || !confirmDiscard()) return;
    selectedSongId = id;
    render();
    document.querySelector('.editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  async createEvent() {
    if (!confirmDiscard()) return;
    const created = await run(() => api.createEvent({ title: 'New event', published: true }), 'Event created');
    if (created) {
      selectedEventId = created.id;
      selectedSongId = null;
      render();
    }
  },

  // Copy an event with all its songs, e.g. to start next month from this month's list.
  async duplicateEvent(event) {
    if (!confirmDiscard()) return;
    const copy = await run(async () => {
      const created = await api.createEvent({ ...event, title: `${event.title} (copy)`, published: false });
      for (const song of event.songs) await api.addSong(created.id, song);
      return created;
    }, 'Event duplicated (unpublished)');
    if (copy) {
      selectedEventId = copy.id;
      selectedSongId = null;
      render();
    }
  },

  saveEvent(id, fields) {
    return run(() => api.updateEvent(id, fields), 'Event saved');
  },

  deleteEvent(event) {
    if (!confirm(`Delete “${event.title}” and all ${event.songs.length} of its songs? This cannot be undone.`)) return;
    editor = null;
    return run(() => api.deleteEvent(event.id), 'Event deleted');
  },

  makeLive(id) {
    if (!confirmDiscard()) return;
    return run(() => api.setCurrentEvent(id), 'This event is now live');
  },

  async saveSong(eventId, songId, fields) {
    const saved = await run(
      () => (songId ? api.updateSong(eventId, songId, fields) : api.addSong(eventId, fields)),
      songId ? 'Song saved' : 'Song added'
    );
    if (saved && !songId) {
      editor = null; // the "new song" form is done; switch to editing the saved song
      selectedSongId = saved.id;
      render();
    }
    return saved;
  },

  deleteSong(eventId, song) {
    if (!confirm(`Delete “${song.title}”?`)) return;
    editor = null;
    selectedSongId = null;
    return run(() => api.deleteSong(eventId, song.id), 'Song deleted');
  },

  reorderSongs(eventId, songIds) {
    if (!confirmDiscard()) return;
    return run(() => api.reorderSongs(eventId, songIds));
  },

  async exportBackup() {
    try {
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `70-80-nights-backup-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err) {
      toast(err.message, 'error');
    }
  },

  async importBackup(file) {
    if (!file) return;
    if (!confirm('Importing replaces ALL events and songs with the contents of this file. Continue?')) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return toast('That file is not valid JSON.', 'error');
    }
    editor = null;
    selectedEventId = null;
    selectedSongId = null;
    return run(() => api.importBackup(data), 'Backup imported');
  },

  logout() {
    if (!confirmDiscard()) return;
    api.logout();
    editor = null;
    showLogin();
  },
};

// ---------- rendering ----------

function render() {
  const event = state.events.find((e) => e.id === selectedEventId);
  const song = event && event.songs.find((s) => s.id === selectedSongId);
  const publicUrl = location.origin + '/';

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: (e) => {
      actions.importBackup(e.currentTarget.files[0]);
      e.currentTarget.value = '';
    },
  });

  const header = h(
    'header',
    { class: 'admin-header' },
    h('h1', {}, '70/80 Nights — Admin'),
    h(
      'div',
      { class: 'btn-row' },
      h('a', { class: 'btn btn-small', href: '/', target: '_blank', rel: 'noopener' }, 'Open attendee view ↗'),
      h(
        'button',
        {
          class: 'btn btn-small',
          onclick: () => navigator.clipboard?.writeText(publicUrl).then(() => toast(`Copied ${publicUrl}`), () => toast(publicUrl)),
        },
        'Copy attendee link'
      ),
      h('button', { class: 'btn btn-small', onclick: actions.exportBackup }, 'Download backup'),
      h('button', { class: 'btn btn-small', onclick: () => fileInput.click() }, 'Restore backup…'),
      fileInput,
      h('button', { class: 'btn btn-small', onclick: actions.logout }, 'Log out')
    )
  );

  editor = event && (song || selectedSongId === 'new') ? SongEditor({ event, song, actions }) : null;

  const main = editor
    ? editor.element
    : h(
        'section',
        { class: 'panel editor editor-empty' },
        h('p', { class: 'muted' }, event ? 'Select a song on the left to edit it, or add a new one.' : 'Create an event to begin.')
      );

  root.replaceChildren(
    header,
    h(
      'div',
      { class: 'admin-layout' },
      h('div', { class: 'admin-side' }, EventPanel({ state, selectedEventId, actions }), SongsPanel({ event, selectedSongId, actions })),
      h('div', { class: 'admin-main' }, main)
    )
  );
}

function showLogin() {
  renderLoginForm(root, { onLoggedIn: () => start() });
}

async function start() {
  if (!api.getToken()) return showLogin();
  try {
    await refresh();
  } catch (err) {
    if (!(err instanceof api.AuthError)) toast(err.message, 'error');
    showLogin();
  }
}

start();
