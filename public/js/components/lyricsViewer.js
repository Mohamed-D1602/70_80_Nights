// Lyrics screen: one song at a time, large text, with previous/next
// navigation by buttons, swipe, or keyboard arrows.

import { h, arabicDigits } from '../dom.js';
import { icon } from '../icons.js';
import { parseLyrics } from '../lyrics.js';
import { getPrefs, setPrefs, FONT_SIZES } from '../prefs.js';
import { keepScreenOn } from '../wakeLock.js';
import { SongCover } from './songList.js';

const SWIPE_MIN_PX = 60;

// Renders lyrics text as stanzas. Also used by the admin live preview.
export function LyricsBody(text) {
  const sections = parseLyrics(text);
  if (!sections.length) return h('p', { class: 'empty' }, 'لا توجد كلمات لهذه الأغنية بعد.');
  return h(
    'div',
    { class: 'lyrics' },
    sections.map((s) =>
      h(
        'section',
        { class: s.isChorus ? 'stanza stanza-chorus' : 'stanza' },
        s.label ? h('h3', { class: 'stanza-label' }, s.label) : null,
        s.lines.map((line) => h('p', { class: 'lyric-line' }, line))
      )
    )
  );
}

export function renderLyricsViewer(container, event, songIndex, { goTo, goHome }) {
  const song = event.songs[songIndex];
  const total = event.songs.length;
  const prevSong = event.songs[songIndex - 1];
  const nextSong = event.songs[songIndex + 1];
  const prefs = getPrefs();

  const changeFont = (delta) => {
    const i = Math.min(Math.max(getPrefs().fontSizeIndex + delta, 0), FONT_SIZES.length - 1);
    setPrefs({ fontSizeIndex: i });
  };
  const toggleTheme = (e) => {
    const theme = getPrefs().theme === 'light' ? 'dark' : 'light';
    setPrefs({ theme });
    e.currentTarget.replaceChildren(icon(theme === 'light' ? 'moon' : 'sun'));
  };

  const toolbar = h(
    'div',
    { class: 'toolbar' },
    h('button', { class: 'icon-btn', onclick: goHome, 'aria-label': 'قائمة الأغاني' }, icon('list')),
    h('span', { class: 'counter' }, `${arabicDigits(songIndex + 1)} / ${arabicDigits(total)}`),
    h(
      'div',
      { class: 'toolbar-group' },
      h('button', { class: 'icon-btn text-btn', onclick: () => changeFont(-1), 'aria-label': 'تصغير الخط' }, 'أ-'),
      h('button', { class: 'icon-btn text-btn', onclick: () => changeFont(1), 'aria-label': 'تكبير الخط' }, 'أ+'),
      h(
        'button',
        { class: 'icon-btn', onclick: toggleTheme, 'aria-label': 'تبديل الوضع الليلي/النهاري' },
        icon(prefs.theme === 'light' ? 'moon' : 'sun')
      )
    )
  );

  const songHeader = h(
    'header',
    { class: 'song-header' },
    SongCover(song, songIndex, 'lg'),
    h(
      'div',
      {},
      h('h1', { class: 'song-title' }, song.title),
      song.artist ? h('p', { class: 'song-artist' }, song.artist) : null,
      song.notes ? h('p', { class: 'song-notes' }, song.notes) : null
    )
  );

  const upNext = nextSong
    ? h(
        'button',
        { class: 'up-next', onclick: () => goTo(songIndex + 1) },
        h('span', { class: 'up-next-label' }, 'الأغنية التالية'),
        h('span', { class: 'up-next-title' }, nextSong.title),
        icon('next')
      )
    : h('p', { class: 'end-note' }, 'نهاية قائمة الليلة — شكراً لغنائكم معنا');

  const bottomNav = h(
    'nav',
    { class: 'bottom-nav', 'aria-label': 'التنقل بين الأغاني' },
    h(
      'button',
      { class: 'nav-btn', disabled: !prevSong, onclick: () => goTo(songIndex - 1) },
      icon('prev'),
      h('span', {}, 'السابقة')
    ),
    h(
      'button',
      { class: 'nav-btn nav-btn-primary', disabled: !nextSong, onclick: () => goTo(songIndex + 1) },
      h('span', {}, 'التالية'),
      icon('next')
    )
  );

  const page = h(
    'div',
    { class: 'page page-lyrics' },
    toolbar,
    h('article', { class: 'lyrics-article' }, songHeader, LyricsBody(song.lyrics), upNext),
    bottomNav
  );
  container.replaceChildren(page);
  document.title = `${song.title} — ${event.title}`;
  keepScreenOn(true);

  // ---- swipe (RTL: drag right → next song, like turning an Arabic page) ----
  let start = null;
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return (start = null);
    start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    start = null;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return; // mostly vertical = scrolling
    if (dx > 0 && nextSong) goTo(songIndex + 1);
    else if (dx < 0 && prevSong) goTo(songIndex - 1);
  };

  // ---- keyboard (laptops/tablets with keyboards) ----
  const onKey = (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft' && nextSong) goTo(songIndex + 1);
    else if (e.key === 'ArrowRight' && prevSong) goTo(songIndex - 1);
    else if (e.key === 'Escape') goHome();
  };

  page.addEventListener('touchstart', onTouchStart, { passive: true });
  page.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('keydown', onKey);

  return () => {
    document.removeEventListener('keydown', onKey);
    keepScreenOn(false);
  };
}
