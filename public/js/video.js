// Video links for program segments.
//
// YouTube links (watch?v=, youtu.be/, shorts/, embed/, live/) become an
// embedded player; any other http(s) link is shown as an "open video" button.

import { h } from './dom.js';

export function youtubeId(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/) || [])[1];
  }
  return id && /^[\w-]{6,20}$/.test(id) ? id : null;
}

// Start time from ?t=90, ?t=1m30s or ?start=90, in seconds.
function startSeconds(url) {
  try {
    const u = new URL(url);
    const t = u.searchParams.get('start') || u.searchParams.get('t');
    if (!t) return 0;
    if (/^\d+$/.test(t)) return Number(t);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    return m ? (Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0)) : 0;
  } catch {
    return 0;
  }
}

export function VideoBlock(url, title) {
  if (!url) return null;
  const id = youtubeId(url);
  const openLink = h('a', { class: 'video-open', href: url, target: '_blank', rel: 'noopener' }, 'فتح المقطع ↗');
  if (!id) return h('div', { class: 'video video-link-only' }, openLink);

  const start = startSeconds(url);
  const src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1${start ? `&start=${start}` : ''}`;
  return h(
    'div',
    { class: 'video' },
    h(
      'div',
      { class: 'video-frame' },
      h('iframe', {
        src,
        title: title || 'مقطع فيديو',
        loading: 'lazy',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
        allowfullscreen: true,
        referrerpolicy: 'strict-origin-when-cross-origin',
      })
    ),
    // Some uploads don't allow embedding; this always works.
    openLink
  );
}
