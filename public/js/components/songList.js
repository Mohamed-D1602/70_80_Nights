// Home screen: the event header and the list of songs for the night.

import { h, arabicDigits, coverGradient, formatDate } from '../dom.js';
import { icon } from '../icons.js';

export function SongCover(song, index, size = 'md') {
  if (song.coverUrl) {
    return h('img', {
      class: `cover cover-${size}`,
      src: song.coverUrl,
      alt: '',
      loading: 'lazy',
      decoding: 'async',
      // If an image link breaks, fall back to the numbered placeholder.
      onerror: (e) => e.currentTarget.replaceWith(placeholder(song, index, size)),
    });
  }
  return placeholder(song, index, size);
}

function placeholder(song, index, size) {
  const el = h('div', { class: `cover cover-${size} cover-placeholder`, 'aria-hidden': 'true' }, arabicDigits(index + 1));
  el.style.background = coverGradient(song.id + song.title);
  return el;
}

export function renderSongList(container, event) {
  const header = h(
    'header',
    { class: 'event-header' },
    h('p', { class: 'eyebrow' }, icon('music'), ' ليلة الغناء الجماعي'),
    h('h1', { class: 'event-title' }, event.title),
    h(
      'p',
      { class: 'event-meta' },
      [formatDate(event.date), event.venue].filter(Boolean).join(' · ')
    ),
    event.description ? h('p', { class: 'event-description' }, event.description) : null
  );

  const list = event.songs.length
    ? h(
        'ol',
        { class: 'song-list' },
        event.songs.map((song, i) =>
          h(
            'li',
            {},
            h(
              'a',
              { class: 'song-card', href: `#/song/${encodeURIComponent(song.id)}` },
              SongCover(song, i),
              h(
                'span',
                { class: 'song-card-text' },
                h('span', { class: 'song-card-title' }, song.title),
                song.artist ? h('span', { class: 'song-card-artist' }, song.artist) : null
              ),
              h('span', { class: 'song-card-number', 'aria-hidden': 'true' }, arabicDigits(i + 1))
            )
          )
        )
      )
    : h('p', { class: 'empty' }, 'لم تُضف أغاني لهذه الليلة بعد.');

  container.replaceChildren(h('div', { class: 'page page-list' }, header, list));
  document.title = event.title;
  return () => {};
}
