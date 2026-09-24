// The running order of songs for the selected event: select, add, reorder.

import { h } from '../dom.js';

export function SongsPanel({ event, selectedSongId, actions }) {
  if (!event) return null;

  const move = (index, delta) => {
    const ids = event.songs.map((s) => s.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id);
    actions.reorderSongs(event.id, ids);
  };

  const items = event.songs.map((song, i) =>
    h(
      'li',
      { class: song.id === selectedSongId ? 'song-row is-selected' : 'song-row' },
      h(
        'button',
        { class: 'song-row-main', onclick: () => actions.selectSong(song.id) },
        h('span', { class: 'song-row-num' }, String(i + 1)),
        h('span', { class: 'song-row-text', dir: 'auto' }, h('strong', {}, song.title), song.artist ? h('small', {}, song.artist) : null)
      ),
      h(
        'span',
        { class: 'song-row-move' },
        h('button', { class: 'btn btn-icon', disabled: i === 0, onclick: () => move(i, -1), 'aria-label': `Move ${song.title} up` }, '↑'),
        h(
          'button',
          { class: 'btn btn-icon', disabled: i === event.songs.length - 1, onclick: () => move(i, 1), 'aria-label': `Move ${song.title} down` },
          '↓'
        )
      )
    )
  );

  return h(
    'section',
    { class: 'panel' },
    h(
      'div',
      { class: 'panel-head' },
      h('h2', {}, `Songs (${event.songs.length})`),
      h('button', { class: 'btn btn-small btn-accent', onclick: () => actions.selectSong('new') }, '+ Add song')
    ),
    items.length ? h('ol', { class: 'song-rows' }, items) : h('p', { class: 'muted' }, 'No songs yet.')
  );
}
