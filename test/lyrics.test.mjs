import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLyrics } from '../public/js/lyrics.js';

test('splits stanzas on blank lines and reads [labels]', () => {
  const sections = parseLyrics('[المقطع الأول]\nسطر ١\nسطر ٢\n\n\n[الكورس]\nكورس ١\n\nبدون عنوان');
  assert.deepEqual(sections, [
    { label: 'المقطع الأول', isChorus: false, lines: ['سطر ١', 'سطر ٢'] },
    { label: 'الكورس', isChorus: true, lines: ['كورس ١'] },
    { label: '', isChorus: false, lines: ['بدون عنوان'] },
  ]);
});

test('handles empty input', () => {
  assert.deepEqual(parseLyrics(''), []);
  assert.deepEqual(parseLyrics(undefined), []);
});

test('recognises English chorus labels', () => {
  assert.equal(parseLyrics('[Chorus]\nla la')[0].isChorus, true);
});
