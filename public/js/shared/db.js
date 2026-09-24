// In-memory database logic shared by the Node server (server/store.js) and
// the browser admin when it runs on GitHub Pages (js/admin/githubBackend.js).
// Pure JavaScript: no fs, no DOM. Keeping it in one place means both hosting
// modes validate and edit data exactly the same way.
//
// Shape:
// {
//   "settings": { "currentEventId": "..." },
//   "events": [
//     { "id", "title", "date", "venue", "description", "published", "createdAt", "updatedAt",
//       "songs": [ { "id", "title", "artist", "coverUrl", "lyrics", "notes" } ] }
//   ]
// }

export class Db {
  // `onChange` runs after every successful mutation (the server saves to disk there).
  constructor(raw, { onChange = () => {} } = {}) {
    this.data = normalizeDb(raw);
    this.onChange = onChange;
  }

  changed() {
    this.onChange(this.data);
  }

  toJSON() {
    return this.data;
  }

  // ----- reads -----

  listEvents() {
    return this.data.events;
  }

  getEvent(id) {
    return this.data.events.find((e) => e.id === id) || null;
  }

  getCurrentEvent() {
    const current = this.getEvent(this.data.settings.currentEventId);
    return current && current.published ? current : null;
  }

  getSettings() {
    return this.data.settings;
  }

  // ----- writes -----

  createEvent(fields) {
    const now = new Date().toISOString();
    const event = { id: newId(), ...eventFields(fields), songs: [], createdAt: now, updatedAt: now };
    this.data.events.push(event);
    if (!this.data.settings.currentEventId) this.data.settings.currentEventId = event.id;
    this.changed();
    return event;
  }

  // Copy an event and all its songs (new ids), unpublished, e.g. to start next month.
  duplicateEvent(id) {
    const source = this.getEvent(id);
    if (!source) return null;
    const now = new Date().toISOString();
    const copy = {
      id: newId(),
      ...eventFields({ ...source, title: `${source.title} (copy)`, published: false }),
      songs: source.songs.map((s) => ({ ...s, id: newId() })),
      createdAt: now,
      updatedAt: now,
    };
    this.data.events.push(copy);
    this.changed();
    return copy;
  }

  updateEvent(id, fields) {
    const event = this.getEvent(id);
    if (!event) return null;
    Object.assign(event, eventFields({ ...event, ...fields }), { updatedAt: new Date().toISOString() });
    this.changed();
    return event;
  }

  deleteEvent(id) {
    const before = this.data.events.length;
    this.data.events = this.data.events.filter((e) => e.id !== id);
    if (this.data.events.length === before) return false;
    if (this.data.settings.currentEventId === id) this.data.settings.currentEventId = null;
    this.changed();
    return true;
  }

  setCurrentEvent(id) {
    if (id !== null && !this.getEvent(id)) return false;
    this.data.settings.currentEventId = id;
    this.changed();
    return true;
  }

  addSong(eventId, fields) {
    const event = this.getEvent(eventId);
    if (!event) return null;
    const song = { id: newId(), ...songFields(fields) };
    event.songs.push(song);
    event.updatedAt = new Date().toISOString();
    this.changed();
    return song;
  }

  updateSong(eventId, songId, fields) {
    const event = this.getEvent(eventId);
    const song = event && event.songs.find((s) => s.id === songId);
    if (!song) return null;
    Object.assign(song, songFields({ ...song, ...fields }));
    event.updatedAt = new Date().toISOString();
    this.changed();
    return song;
  }

  deleteSong(eventId, songId) {
    const event = this.getEvent(eventId);
    if (!event) return false;
    const before = event.songs.length;
    event.songs = event.songs.filter((s) => s.id !== songId);
    if (event.songs.length === before) return false;
    event.updatedAt = new Date().toISOString();
    this.changed();
    return true;
  }

  // `songIds` must contain exactly the event's current song ids, in the new order.
  reorderSongs(eventId, songIds) {
    const event = this.getEvent(eventId);
    if (!event || !Array.isArray(songIds)) return null;
    const byId = new Map(event.songs.map((s) => [s.id, s]));
    if (songIds.length !== byId.size || !songIds.every((id) => byId.has(id))) return null;
    event.songs = songIds.map((id) => byId.get(id));
    event.updatedAt = new Date().toISOString();
    this.changed();
    return event;
  }

  // Replace the whole database (the admin "restore backup" feature).
  // Throws on invalid input without touching the current data.
  replaceAll(raw) {
    this.data = normalizeDb(raw);
    this.changed();
  }
}

// ----- validation helpers -----

function newId() {
  return globalThis.crypto.randomUUID();
}

function str(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

// Only allow http(s) and relative image URLs, so a cover URL can never
// become a `javascript:` link or similar.
function safeUrl(value) {
  const url = str(value, 2000);
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return ''; // other schemes / protocol-relative
  return url; // relative path such as covers/song.jpg
}

function eventFields(f) {
  return {
    title: str(f.title, 200) || 'Untitled event',
    date: /^\d{4}-\d{2}-\d{2}$/.test(f.date) ? f.date : '',
    venue: str(f.venue, 200),
    description: str(f.description, 2000),
    published: f.published !== false,
  };
}

function songFields(f) {
  return {
    title: str(f.title, 200) || 'Untitled song',
    artist: str(f.artist, 200),
    coverUrl: safeUrl(f.coverUrl),
    // Lyrics keep their inner whitespace/line breaks; only normalise newlines.
    lyrics: typeof f.lyrics === 'string' ? f.lyrics.replace(/\r\n?/g, '\n').slice(0, 50000) : '',
    notes: str(f.notes, 500),
  };
}

export function normalizeDb(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.events)) {
    throw new Error('Invalid data: expected an object with an "events" array');
  }
  const events = raw.events.map((e) => ({
    id: typeof e.id === 'string' && e.id ? e.id : newId(),
    ...eventFields(e || {}),
    songs: (Array.isArray(e.songs) ? e.songs : []).map((s) => ({
      id: typeof s.id === 'string' && s.id ? s.id : newId(),
      ...songFields(s || {}),
    })),
    createdAt: e.createdAt || new Date().toISOString(),
    updatedAt: e.updatedAt || new Date().toISOString(),
  }));
  const currentEventId = raw.settings && raw.settings.currentEventId;
  return {
    settings: { currentEventId: events.some((e) => e.id === currentEventId) ? currentEventId : null },
    events,
  };
}
