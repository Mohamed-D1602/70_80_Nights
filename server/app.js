const path = require('path');
const express = require('express');
const { openStore } = require('./store');
const { createAuth } = require('./auth');

function createApp({ dataDir, adminPassword, sessionSecret }) {
  const store = openStore(dataDir);
  const auth = createAuth({ password: adminPassword, secret: sessionSecret });
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // correct client IPs behind Render/Railway/Nginx
  app.use(express.json({ limit: '5mb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    next();
  });

  // ------------------------------------------------------------------
  // Public API (attendees) — read-only, no login.
  // ------------------------------------------------------------------
  const pub = express.Router();
  pub.use((req, res, next) => {
    res.set('Cache-Control', 'no-cache'); // always revalidate so edits show up
    next();
  });

  // All published events (for a future "past events" archive page).
  pub.get('/events', (req, res) => {
    const currentId = store.getSettings().currentEventId;
    res.json(
      store
        .listEvents()
        .filter((e) => e.published)
        .map((e) => ({ ...eventSummary(e), isCurrent: e.id === currentId }))
    );
  });

  pub.get('/events/current', (req, res) => {
    const event = store.getCurrentEvent();
    if (!event) return res.status(404).json({ error: 'No event is scheduled yet' });
    res.json(event);
  });

  pub.get('/events/:id', (req, res) => {
    const event = store.getEvent(req.params.id);
    if (!event || !event.published) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  });

  app.use('/api', pub);

  // ------------------------------------------------------------------
  // Admin API — everything below requires a valid token.
  // ------------------------------------------------------------------
  const admin = express.Router();

  admin.post('/login', (req, res) => {
    if (!auth.enabled) {
      return res.status(503).json({ error: 'Admin is disabled: set ADMIN_PASSWORD on the server and restart it.' });
    }
    const result = auth.checkPassword(req.ip, req.body && req.body.password);
    if (result.locked) return res.status(429).json({ error: 'Too many attempts. Try again in 5 minutes.' });
    if (!result.ok) return res.status(401).json({ error: 'Wrong password' });
    res.json({ token: auth.issueToken() });
  });

  admin.use(auth.requireAdmin);
  admin.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  admin.get('/state', (req, res) => {
    res.json({ settings: store.getSettings(), events: store.listEvents() });
  });

  admin.post('/events', (req, res) => {
    res.status(201).json(store.createEvent(req.body || {}));
  });

  admin.post('/events/:id/duplicate', (req, res) => {
    const copy = store.duplicateEvent(req.params.id);
    if (!copy) return res.status(404).json({ error: 'Event not found' });
    res.status(201).json(copy);
  });

  admin.put('/events/:id', (req, res) => {
    const event = store.updateEvent(req.params.id, req.body || {});
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  });

  admin.delete('/events/:id', (req, res) => {
    if (!store.deleteEvent(req.params.id)) return res.status(404).json({ error: 'Event not found' });
    res.status(204).end();
  });

  admin.put('/settings/current-event', (req, res) => {
    const id = req.body && req.body.eventId !== undefined ? req.body.eventId : undefined;
    if (id === undefined || !store.setCurrentEvent(id)) return res.status(400).json({ error: 'Unknown event' });
    res.json(store.getSettings());
  });

  admin.post('/events/:id/songs', (req, res) => {
    const song = store.addSong(req.params.id, req.body || {});
    if (!song) return res.status(404).json({ error: 'Event not found' });
    res.status(201).json(song);
  });

  admin.put('/events/:id/songs/order', (req, res) => {
    const event = store.reorderSongs(req.params.id, req.body && req.body.songIds);
    if (!event) return res.status(400).json({ error: 'songIds must list every song of the event exactly once' });
    res.json(event);
  });

  admin.put('/events/:id/songs/:songId', (req, res) => {
    const song = store.updateSong(req.params.id, req.params.songId, req.body || {});
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json(song);
  });

  admin.delete('/events/:id/songs/:songId', (req, res) => {
    if (!store.deleteSong(req.params.id, req.params.songId)) return res.status(404).json({ error: 'Song not found' });
    res.status(204).end();
  });

  // Full backup / restore of the database as JSON.
  admin.get('/export', (req, res) => {
    const stamp = new Date().toISOString().slice(0, 10);
    res.set('Content-Disposition', `attachment; filename="70-80-nights-backup-${stamp}.json"`);
    res.json({ settings: store.getSettings(), events: store.listEvents() });
  });

  admin.post('/import', (req, res) => {
    try {
      store.replaceAll(req.body);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({ settings: store.getSettings(), events: store.listEvents() });
  });

  app.use('/api/admin', admin);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // ------------------------------------------------------------------
  // Static frontend
  // ------------------------------------------------------------------
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(
    express.static(publicDir, {
      setHeaders(res, filePath) {
        // HTML, JS, CSS and the service worker revalidate on every load so a
        // redeploy is picked up immediately; the SW provides offline caching.
        res.set('Cache-Control', 'no-cache');
        if (filePath.endsWith('sw.js')) res.set('Service-Worker-Allowed', '/');
      },
    })
  );
  // Asset URLs in the HTML are relative (so the same files work on GitHub
  // Pages under /<repo>/), so pages must be served from the site root.
  app.get(['/admin', '/admin/'], (req, res) => res.redirect(301, '/admin.html'));
  // The attendee app uses hash routes (#/song/...); any other path goes home.
  app.get('*', (req, res) => res.redirect('/'));

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });

  return app;
}

function eventSummary(e) {
  return { id: e.id, title: e.title, date: e.date, venue: e.venue, songCount: e.songs.length };
}

module.exports = { createApp };
