// Per-device viewer preferences (font size, theme), kept in localStorage.
// Storage can be unavailable (private mode, blocked site data), so every
// access is wrapped and the app works fine without it.

const KEY = 'nights.prefs';
export const FONT_SIZES = [20, 24, 28, 32, 38, 44, 52];
const DEFAULTS = { fontSizeIndex: 2, theme: 'dark' };

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

let prefs = read();

export function getPrefs() {
  return prefs;
}

export function setPrefs(patch) {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  applyPrefs();
}

export function applyPrefs() {
  const idx = Math.min(Math.max(prefs.fontSizeIndex, 0), FONT_SIZES.length - 1);
  document.documentElement.style.setProperty('--lyrics-size', `${FONT_SIZES[idx]}px`);
  document.documentElement.dataset.theme = prefs.theme === 'light' ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = prefs.theme === 'light' ? '#f7f1e3' : '#0c0a09';
}
