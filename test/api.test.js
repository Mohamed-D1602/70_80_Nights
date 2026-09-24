const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server/app');

let server;
let base;
let dataDir;
let token;

async function call(method, url, { body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nights-test-'));
  const app = createApp({ dataDir, adminPassword: 'secret-pass', sessionSecret: 'test-secret' });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('seeds the database and serves the current event publicly', async () => {
  const res = await call('GET', '/api/events/current', { auth: false });
  assert.equal(res.status, 200);
  assert.equal(res.body.id, 'sample-event');
  assert.equal(res.body.songs.length, 3);
  assert.ok(fs.existsSync(path.join(dataDir, 'db.json')));
});

test('admin routes reject missing or bad credentials', async () => {
  assert.equal((await call('GET', '/api/admin/state', { auth: false })).status, 401);
  assert.equal((await call('POST', '/api/admin/login', { body: { password: 'nope' }, auth: false })).status, 401);
  const res = await fetch(`${base}/api/admin/state`, { headers: { Authorization: 'Bearer forged.token' } });
  assert.equal(res.status, 401);
});

test('admin can log in and manage events and songs', async () => {
  const login = await call('POST', '/api/admin/login', { body: { password: 'secret-pass' }, auth: false });
  assert.equal(login.status, 200);
  token = login.body.token;

  const ev = await call('POST', '/api/admin/events', { body: { title: 'November night', date: '2026-11-27', venue: 'Hall' } });
  assert.equal(ev.status, 201);
  const eventId = ev.body.id;

  const s1 = await call('POST', `/api/admin/events/${eventId}/songs`, {
    body: { title: 'أغنية', artist: 'فنان', lyrics: '[الكورس]\r\nسطر\r\n\r\nسطر ٢', coverUrl: 'javascript:alert(1)' },
  });
  assert.equal(s1.status, 201);
  assert.equal(s1.body.lyrics, '[الكورس]\nسطر\n\nسطر ٢', 'normalises CRLF');
  assert.equal(s1.body.coverUrl, '', 'rejects non-http cover URLs');

  const s2 = await call('POST', `/api/admin/events/${eventId}/songs`, { body: { title: 'Second' } });

  const upd = await call('PUT', `/api/admin/events/${eventId}/songs/${s1.body.id}`, { body: { artist: 'Updated' } });
  assert.equal(upd.body.artist, 'Updated');
  assert.equal(upd.body.title, 'أغنية', 'partial update keeps other fields');

  const bad = await call('PUT', `/api/admin/events/${eventId}/songs/order`, { body: { songIds: [s1.body.id] } });
  assert.equal(bad.status, 400);
  const order = await call('PUT', `/api/admin/events/${eventId}/songs/order`, { body: { songIds: [s2.body.id, s1.body.id] } });
  assert.deepEqual(order.body.songs.map((s) => s.title), ['Second', 'أغنية']);

  // Not live yet: public current event is still the seed.
  assert.equal((await call('GET', '/api/events/current', { auth: false })).body.id, 'sample-event');
  assert.equal((await call('PUT', '/api/admin/settings/current-event', { body: { eventId } })).status, 200);
  assert.equal((await call('GET', '/api/events/current', { auth: false })).body.id, eventId);

  // Unpublishing hides it from attendees.
  await call('PUT', `/api/admin/events/${eventId}`, { body: { published: false } });
  assert.equal((await call('GET', '/api/events/current', { auth: false })).status, 404);
  assert.equal((await call('GET', `/api/events/${eventId}`, { auth: false })).status, 404);
  await call('PUT', `/api/admin/events/${eventId}`, { body: { published: true } });

  assert.equal((await call('DELETE', `/api/admin/events/${eventId}/songs/${s2.body.id}`)).status, 204);

  // Data survives a restart (a fresh app reading the same data dir).
  const again = createApp({ dataDir, adminPassword: 'x' });
  const srv = await new Promise((r) => {
    const s = again.listen(0, () => r(s));
  });
  const res = await fetch(`http://127.0.0.1:${srv.address().port}/api/events/current`);
  const persisted = await res.json();
  srv.close();
  assert.equal(persisted.id, eventId);
  assert.equal(persisted.songs.length, 1);
});

test('export/import round-trips and rejects garbage', async () => {
  const exported = await call('GET', '/api/admin/export');
  assert.equal(exported.status, 200);
  assert.equal((await call('POST', '/api/admin/import', { body: { nope: true } })).status, 400);
  const imported = await call('POST', '/api/admin/import', { body: exported.body });
  assert.equal(imported.status, 200);
  assert.deepEqual(imported.body.events.map((e) => e.id), exported.body.events.map((e) => e.id));
});

test('deleting the live event clears the current event', async () => {
  const { body } = await call('GET', '/api/admin/state');
  await call('DELETE', `/api/admin/events/${body.settings.currentEventId}`);
  assert.equal((await call('GET', '/api/events/current', { auth: false })).status, 404);
});

test('serves the attendee app and admin page', async () => {
  const home = await fetch(`${base}/`);
  assert.match(await home.text(), /dir="rtl"/);
  const admin = await fetch(`${base}/admin`);
  assert.match(await admin.text(), /Admin/);
});
