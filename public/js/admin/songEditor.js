// Program segment form (a clip, a song, a sing-along): title, performer,
// optional video link and optional lyrics, with live previews.

import { h } from '../dom.js';
import { LyricsBody } from '../components/lyricsViewer.js';
import { VideoBlock } from '../video.js';
import { textField, textArea, formValues } from './fields.js';

const HELP = `Lyrics are optional (for sing-along). How to write them:
• One sung line per line.
• Leave an empty line between verses.
• Put a section name in square brackets on its own line, e.g. [المقطع الأول] or [الكورس].
• Sections named كورس / الكورس / chorus are highlighted so the audience knows when to join in.`;

// Returns { element, isDirty() }.
export function SongEditor({ event, song, actions }) {
  const isNew = !song;
  const initial = song || { title: '', artist: '', coverUrl: '', videoUrl: '', notes: '', lyrics: '' };
  let dirty = false;

  const preview = h('div', { class: 'preview-body', dir: 'rtl' });
  const coverPreview = h('img', { class: 'cover-preview', alt: '', hidden: !initial.coverUrl, src: initial.coverUrl || undefined });
  const updatePreview = (text) => preview.replaceChildren(LyricsBody(text, { emptyText: 'No lyrics (fine for a clip-only segment).' }));
  const videoPreview = h('div', { class: 'video-preview', dir: 'rtl' });
  const updateVideo = (url) => videoPreview.replaceChildren(VideoBlock(url, '') || '');
  updateVideo(initial.videoUrl);
  updatePreview(initial.lyrics);

  const form = h(
    'form',
    {
      class: 'stack',
      oninput: (e) => {
        dirty = true;
        if (e.target.name === 'lyrics') updatePreview(e.target.value);
        if (e.target.name === 'coverUrl') {
          coverPreview.hidden = !e.target.value;
          if (e.target.value) coverPreview.src = e.target.value;
        }
      },
      // Rebuild the video player only when the link is finished, not per keystroke.
      onchange: (e) => {
        if (e.target.name === 'videoUrl') updateVideo(e.target.value);
      },
      onsubmit: async (e) => {
        e.preventDefault();
        const saved = await actions.saveSong(event.id, isNew ? null : song.id, formValues(e.currentTarget));
        if (saved) dirty = false;
      },
    },
    h(
      'div',
      { class: 'grid-2' },
      textField('Segment title', 'title', initial.title, { dir: 'auto', required: true, placeholder: 'اسم الأغنية أو الفقرة' }),
      textField('Artist / performer', 'artist', initial.artist, { dir: 'auto', placeholder: 'اسم الفنان' })
    ),
    textField('Video link (YouTube or any web link, optional)', 'videoUrl', initial.videoUrl, {
      type: 'url',
      dir: 'ltr',
      placeholder: 'https://www.youtube.com/watch?v=…',
    }),
    videoPreview,
    h(
      'div',
      { class: 'cover-row' },
      textField('Cover image URL (optional)', 'coverUrl', initial.coverUrl, {
        type: 'url',
        dir: 'ltr',
        placeholder: 'https://… (empty: video thumbnail or a numbered tile)',
      }),
      coverPreview
    ),
    textField('Short note (optional, e.g. composer or year)', 'notes', initial.notes, { dir: 'auto' }),
    h(
      'div',
      { class: 'lyrics-edit' },
      textArea('Lyrics (optional)', 'lyrics', initial.lyrics, { dir: 'rtl', rows: 18, class: 'lyrics-input', spellcheck: 'false' }),
      h('div', { class: 'preview' }, h('span', { class: 'preview-label' }, 'Phone preview'), preview)
    ),
    h('pre', { class: 'help' }, HELP),
    h(
      'div',
      { class: 'btn-row sticky-actions' },
      h('button', { class: 'btn btn-primary', type: 'submit' }, isNew ? 'Add segment' : 'Save segment'),
      isNew
        ? h('button', { class: 'btn', type: 'button', onclick: () => actions.selectSong(null) }, 'Cancel')
        : h('button', { class: 'btn btn-danger', type: 'button', onclick: () => actions.deleteSong(event.id, song) }, 'Delete segment'),
      isNew
        ? null
        : h('a', { class: 'btn', href: `./#/song/${encodeURIComponent(song.id)}`, target: '_blank', rel: 'noopener' }, 'View as attendee ↗')
    )
  );

  const element = h(
    'section',
    { class: 'panel editor' },
    h('div', { class: 'panel-head' }, h('h2', {}, isNew ? 'New segment' : 'Edit segment')),
    form
  );

  return { element, isDirty: () => dirty };
}
