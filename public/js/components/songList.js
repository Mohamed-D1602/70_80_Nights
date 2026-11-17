// Program page and the segment covers it (and the segment page) use.

import { h, arabicDigits, coverGradient, formatDate } from '../dom.js';
import { icon } from '../icons.js';
import { youtubeId } from '../video.js';

export function SongCover(song, index, size = 'md') {
  // No cover image but a YouTube clip → use the clip's thumbnail.
  const ytId = !song.coverUrl && song.videoUrl ? youtubeId(song.videoUrl) : null;
  const src = song.coverUrl || (ytId ? `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg` : '');
  if (src) {
    return h('img', {
      class: `cover cover-${size}`,
      src,
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

const meta = (e) => [formatDate(e.date), e.venue].filter(Boolean).join(' · ');

function Program(event) {
  if (!event.songs.length) return h('p', { class: 'empty' }, 'سيُعلن برنامج الليلة قريباً.');
  return h(
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
          song.videoUrl ? h('span', { class: 'song-card-badge', title: 'مقطع فيديو' }, icon('play')) : null,
          h('span', { class: 'song-card-number', 'aria-hidden': 'true' }, arabicDigits(i + 1))
        )
      )
    )
  );
}

// Program page (#/program): the next evening and its segments.
export function renderSongList(container, { site, event }) {
  const back = h('a', { class: 'back-link', href: '#/' }, icon('prev'), site.name);
  const content = event
    ? [
        h(
          'header',
          { class: 'event-header' },
          h('p', { class: 'section-label' }, 'برنامج الليلة'),
          h('h1', { class: 'event-title' }, event.title),
          meta(event) ? h('p', { class: 'event-meta' }, meta(event)) : null,
          event.description ? h('p', { class: 'event-description' }, event.description) : null
        ),
        Program(event),
      ]
    : [h('p', { class: 'empty' }, 'يُعلن برنامج الليلة القادمة قريباً.')];

  container.replaceChildren(h('div', { class: 'page page-list' }, h('nav', { class: 'top-nav' }, back), ...content));
  document.title = event ? `برنامج ${event.title} — ${site.name}` : site.name;
  return () => {};
}
