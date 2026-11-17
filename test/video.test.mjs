import { test } from 'node:test';
import assert from 'node:assert/strict';
import { youtubeId } from '../public/js/video.js';

test('recognises the usual YouTube link forms', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=G9_Vas5OrdA',
    'https://m.youtube.com/watch?v=G9_Vas5OrdA&t=30s',
    'https://youtu.be/G9_Vas5OrdA?si=xyz',
    'https://www.youtube.com/shorts/G9_Vas5OrdA',
    'https://www.youtube.com/embed/G9_Vas5OrdA',
  ]) {
    assert.equal(youtubeId(url), 'G9_Vas5OrdA', url);
  }
});

test('non-YouTube or broken links give null', () => {
  assert.equal(youtubeId('https://vimeo.com/123'), null);
  assert.equal(youtubeId('not a url'), null);
  assert.equal(youtubeId('https://www.youtube.com/watch?v=<bad>'), null);
});
