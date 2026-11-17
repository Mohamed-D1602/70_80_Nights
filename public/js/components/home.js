// Landing page (#/): explains the idea and invites families.
//
//   hero (name, tagline, buttons, illustrated scene) → the idea → how an
//   evening goes (highlight cards) → photos → next evening → upcoming
//   evenings → join us → credit
//
// All wording comes from the "Site text" panel in admin.

import { h, formatDate } from '../dom.js';
import { icon } from '../icons.js';

const HIGHLIGHT_ICONS = ['family', 'music', 'calm', 'calendar', 'heart'];

// "title | description" per line → [{ title, text }]
function parseHighlights(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, ...rest] = line.split('|');
      return { title: title.trim(), text: rest.join('|').trim() };
    });
}

// "image link | caption | credit" per line → [{ src, caption, credit }].
// Only https:// links and site-relative paths (e.g. photos/nile.jpg).
function parsePhotos(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter(([src]) => src && (/^https:\/\//i.test(src) || /^[\w./-]+\.(jpe?g|png|webp|gif|avif)$/i.test(src)))
    .map(([src, caption = '', credit = '']) => ({ src, caption, credit }));
}

function Gallery(photos) {
  return h(
    'section',
    { class: 'home-section' },
    h('h2', { class: 'section-title' }, 'صور من السودان'),
    h(
      'div',
      { class: 'gallery' },
      photos.map((p) =>
        h(
          'figure',
          { class: 'photo' },
          h('img', {
            src: p.src,
            alt: p.caption || '',
            loading: 'lazy',
            decoding: 'async',
            // A broken link shouldn't leave an empty frame.
            onerror: (e) => e.currentTarget.closest('figure').remove(),
          }),
          p.caption || p.credit
            ? h('figcaption', {}, p.caption ? h('span', {}, p.caption) : null, p.credit ? h('small', {}, p.credit) : null)
            : null
        )
      )
    )
  );
}

const meta = (e) => [formatDate(e.date), e.venue].filter(Boolean).join(' · ');

function NextEvening(event) {
  if (!event) {
    return h(
      'div',
      { class: 'next-card' },
      h('p', { class: 'section-label' }, 'الليلة القادمة'),
      h('p', { class: 'next-soon' }, 'يُعلن موعد الليلة القادمة قريباً.')
    );
  }
  return h(
    'div',
    { class: 'next-card' },
    h('p', { class: 'section-label' }, 'الليلة القادمة'),
    h('h3', { class: 'next-title' }, event.title),
    event.date ? h('p', { class: 'next-meta' }, icon('calendar'), formatDate(event.date)) : null,
    event.venue ? h('p', { class: 'next-meta' }, icon('pin'), event.venue) : null,
    event.description ? h('p', { class: 'next-desc' }, event.description) : null,
    event.songs.length
      ? h('a', { class: 'btn-cta', href: '#/program' }, `برنامج الليلة (${event.songs.length} فقرة)`, icon('next'))
      : null
  );
}

export function renderHome(container, { site, event, upcoming }) {
  const highlights = parseHighlights(site.highlights);

  const hero = h(
    'header',
    { class: 'hero' },
    h(
      'div',
      { class: 'hero-inner' },
      h('p', { class: 'hero-eyebrow' }, icon('music'), ' ليالي سمر للأسر'),
      h('h1', { class: 'hero-title' }, site.name),
      site.tagline ? h('p', { class: 'hero-tagline' }, site.tagline) : null,
      h(
        'div',
        { class: 'hero-actions' },
        event && event.songs.length ? h('a', { class: 'btn-cta', href: '#/program' }, 'برنامج الليلة القادمة') : null,
        h('a', { class: 'btn-ghost', href: '#idea', onclick: scrollTo('idea') }, 'ما هي الفكرة؟')
      )
    ),
    h('img', { class: 'hero-scene', src: 'img/hero-scene.svg', alt: '', 'aria-hidden': 'true' }),
    h('div', { class: 'nubian-strip', 'aria-hidden': 'true' })
  );

  const idea = site.about
    ? h('section', { class: 'home-section', id: 'idea' }, h('h2', { class: 'section-title' }, 'الفكرة'), h('div', { class: 'prose' }, site.about))
    : h('span', { id: 'idea' });

  const how = highlights.length
    ? h(
        'section',
        { class: 'home-section' },
        h('h2', { class: 'section-title' }, 'كيف تكون الليلة؟'),
        h(
          'ul',
          { class: 'highlights' },
          highlights.map((item, i) =>
            h(
              'li',
              { class: 'highlight' },
              h('span', { class: 'highlight-icon' }, icon(HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length])),
              h('strong', {}, item.title),
              item.text ? h('p', {}, item.text) : null
            )
          )
        )
      )
    : null;

  const photos = parsePhotos(site.photos);
  const gallery = photos.length ? Gallery(photos) : null;

  const next = h('section', { class: 'home-section' }, NextEvening(event));

  const later = upcoming.length
    ? h(
        'section',
        { class: 'home-section' },
        h('h2', { class: 'section-title' }, 'ليالٍ قادمة'),
        h(
          'ul',
          { class: 'upcoming-list' },
          upcoming.map((e) => h('li', {}, h('strong', {}, e.title), meta(e) ? h('span', {}, meta(e)) : null))
        )
      )
    : null;

  const join = site.join || site.contact
    ? h(
        'section',
        { class: 'home-section join' },
        h('h2', { class: 'section-title' }, 'شارك معنا'),
        site.join ? h('div', { class: 'prose' }, site.join) : null,
        site.contact ? h('p', { class: 'contact' }, site.contact) : null
      )
    : null;

  const footer = h(
    'footer',
    { class: 'home-footer' },
    h('div', { class: 'nubian-strip small', 'aria-hidden': 'true' }),
    site.founder ? h('p', { class: 'founder' }, site.founder) : null,
    h('p', { class: 'footer-name' }, site.name)
  );

  container.replaceChildren(
    h('div', { class: 'home' }, hero, h('div', { class: 'page home-body' }, idea, how, gallery, next, later, join, footer))
  );
  document.title = site.name;
  return () => {};
}

// In-page links like #idea would clash with the hash router, so scroll instead.
function scrollTo(id) {
  return (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}
