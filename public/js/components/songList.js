// Home page: the group's name and tagline, the next evening and its program,
// other upcoming evenings, and "about the idea" (all text editable in admin).

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

export function renderSongList(container, { site, event, upcoming }) {
  const hero = h(
    'header',
    { class: 'site-hero' },
    h('p', { class: 'eyebrow' }, icon('music'), ' ', site.name),
    site.tagline ? h('h1', { class: 'site-tagline' }, site.tagline) : h('h1', { class: 'site-tagline' }, site.name)
  );

  const evening = event
    ? h(
        'section',
        { class: 'evening', 'aria-labelledby': 'evening-title' },
        h('p', { class: 'section-label' }, 'الليلة القادمة'),
        h('h2', { class: 'event-title', id: 'evening-title' }, event.title),
        meta(event) ? h('p', { class: 'event-meta' }, meta(event)) : null,
        event.description ? h('p', { class: 'event-description' }, event.description) : null,
        h('h3', { class: 'program-title' }, 'برنامج الليلة'),
        Program(event)
      )
    : h(
        'section',
        { class: 'evening' },
        h('p', { class: 'section-label' }, 'الليلة القادمة'),
        h('p', { class: 'empty' }, 'سيُعلن موعد الليلة القادمة قريباً.')
      );

  const later = upcoming.length
    ? h(
        'section',
        { class: 'upcoming' },
        h('h2', { class: 'section-title' }, 'ليالٍ قادمة'),
        h(
          'ul',
          { class: 'upcoming-list' },
          upcoming.map((e) => h('li', {}, h('strong', {}, e.title), meta(e) ? h('span', {}, meta(e)) : null))
        )
      )
    : null;

  const about = site.about || site.founder
    ? h(
        'section',
        { class: 'about' },
        h('h2', { class: 'section-title' }, 'عن الفكرة'),
        site.about ? h('div', { class: 'about-text' }, site.about) : null,
        site.founder ? h('p', { class: 'founder' }, site.founder) : null
      )
    : null;

  container.replaceChildren(h('div', { class: 'page page-list' }, hero, evening, later, about));
  document.title = site.name;
  return () => {};
}
