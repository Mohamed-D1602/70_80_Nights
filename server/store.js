// Tiny JSON-file database.
//
// All data lives in one file (<DATA_DIR>/db.json). That is plenty for a
// monthly event with a few dozen songs, needs no database server, and the
// file doubles as a human-readable backup. Writes are atomic (write to a
// temp file, then rename) so a crash mid-write cannot corrupt the data.
//
// Shape:
// {
//   "settings": { "currentEventId": "..." },
//   "events": [
//     { "id", "title", "date", "venue", "published", "createdAt", "updatedAt",
//       "songs": [ { "id", "title", "artist", "coverUrl", "lyrics", "notes" } ] }
//   ]
// }

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SEED_FILE = path.join(__dirname, '..', 'data', 'seed.json');

class Store {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'db.json');
    fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(this.file)) {
      const seed = fs.existsSync(SEED_FILE)
        ? JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
        : { settings: { currentEventId: null }, events: [] };
      this.data = normalizeDb(seed);
      this.save();
    } else {
      this.data = normalizeDb(JSON.parse(fs.readFileSync(this.file, 'utf8')));
    }
  }

  save() {
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
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
    this.save();
    return event;
  }

  updateEvent(id, fields) {
    const event = this.getEvent(id);
    if (!event) return null;
    Object.assign(event, eventFields({ ...event, ...fields }), { updatedAt: new Date().toISOString() });
    this.save();
    return event;
  }

  deleteEvent(id) {
    const before = this.data.events.length;
    this.data.events = this.data.events.filter((e) => e.id !== id);
    if (this.data.events.length === before) return false;
    if (this.data.settings.currentEventId === id) this.data.settings.currentEventId = null;
    this.save();
    return true;
  }

  setCurrentEvent(id) {
    if (id !== null && !this.getEvent(id)) return false;
    this.data.settings.currentEventId = id;
    this.save();
    return true;
  }

  addSong(eventId, fields) {
    const event = this.getEvent(eventId);
    if (!event) return null;
    const song = { id: newId(), ...songFields(fields) };
    event.songs.push(song);
    event.updatedAt = new Date().toISOString();
    this.save();
    return song;
  }

  updateSong(eventId, songId, fields) {
    const event = this.getEvent(eventId);
    const song = event && event.songs.find((s) => s.id === songId);
    if (!song) return null;
    Object.assign(song, songFields({ ...song, ...fields }));
    event.updatedAt = new Date().toISOString();
    this.save();
    return song;
  }

  deleteSong(eventId, songId) {
    const event = this.getEvent(eventId);
    if (!event) return false;
    const before = event.songs.length;
    event.songs = event.songs.filter((s) => s.id !== songId);
    if (event.songs.length === before) return false;
    event.updatedAt = new Date().toISOString();
    this.save();
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
    this.save();
    return event;
  }

  // Replace the whole database (used by the admin "import backup" feature).
  replaceAll(data) {
    this.data = normalizeDb(data);
    this.save();
  }
}

// ----- validation helpers -----

function newId() {
  return crypto.randomUUID();
}

function str(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

// Only allow http(s) and site-relative image URLs, so a cover URL can never
// become a `javascript:` link or similar.
function safeUrl(value) {
  const url = str(value, 2000);
  return /^(https?:\/\/|\/)/i.test(url) ? url : '';
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

function normalizeDb(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.events)) {
    throw new Error('Invalid database: expected an object with an "events" array');
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

module.exports = { Store };
