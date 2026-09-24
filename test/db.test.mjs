import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Db } from '../public/js/shared/db.js';

test('the committed songs file is valid and has a live event', () => {
  const db = new Db(JSON.parse(readFileSync(new URL('../public/data/db.json', import.meta.url))));
  assert.ok(db.getCurrentEvent(), 'public/data/db.json should have a published live event');
});

test('cover URLs: allows http(s) and relative paths, blocks other schemes', () => {
  const db = new Db({ events: [] });
  const ev = db.createEvent({ title: 'e' });
  const cover = (coverUrl) => db.addSong(ev.id, { coverUrl }).coverUrl;
  assert.equal(cover('https://x.test/a.jpg'), 'https://x.test/a.jpg');
  assert.equal(cover('covers/a.jpg'), 'covers/a.jpg');
  assert.equal(cover('javascript:alert(1)'), '');
  assert.equal(cover('data:image/png;base64,xx'), '');
  assert.equal(cover('//evil.test/a.jpg'), '');
});

test('onChange fires after mutations only', () => {
  let n = 0;
  const db = new Db({ events: [] }, { onChange: () => n++ });
  db.listEvents();
  const ev = db.createEvent({});
  db.updateEvent('missing', {});
  db.addSong(ev.id, {});
  assert.equal(n, 2);
});

test('replaceAll rejects invalid data and keeps the old data', () => {
  const db = new Db({ events: [{ id: 'a', title: 'A' }] });
  assert.throws(() => db.replaceAll({ nope: 1 }));
  assert.equal(db.getEvent('a').title, 'A');
});
