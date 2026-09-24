// Tiny helper for building DOM nodes without innerHTML (so song text from
// the database can never inject HTML).
//
//   h('button', { class: 'btn', onclick: fn, 'aria-label': 'Next' }, 'التالي')

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

// Arabic-Indic digits for numbers shown to attendees (١٢٣).
export function arabicDigits(n) {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
}

// Stable warm gradient per song, used when a song has no cover image.
export function coverGradient(seed) {
  let hash = 0;
  for (const ch of String(seed)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  const hue = 15 + (hash % 40); // oranges → golds: a 70s palette
  const hue2 = (hue + 300 + (hash % 50)) % 360; // into plum/wine
  return `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${hue2} 45% 25%))`;
}

// "2026-10-30" → "الجمعة ٣٠ أكتوبر ٢٠٢٦" (falls back to the raw string)
export function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat('ar-SD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  } catch {
    return iso;
  }
}
