// Event picker + event details form (title, date, venue, published, live).

import { h } from '../dom.js';
import { textField, textArea, checkbox, formValues } from './fields.js';

export function EventPanel({ state, selectedEventId, actions }) {
  const { events, settings } = state;
  const event = events.find((e) => e.id === selectedEventId);

  const picker = h(
    'select',
    {
      'aria-label': 'Choose event',
      onchange: (e) => actions.selectEvent(e.currentTarget.value),
    },
    events.map((ev) =>
      h(
        'option',
        { value: ev.id, selected: ev.id === selectedEventId },
        `${ev.date || 'No date'} — ${ev.title}${ev.id === settings.currentEventId ? '  (LIVE)' : ''}`
      )
    )
  );

  const top = h(
    'div',
    { class: 'panel-head' },
    h('h2', {}, 'Events'),
    h(
      'div',
      { class: 'btn-row' },
      h('button', { class: 'btn btn-small', onclick: () => actions.createEvent() }, '+ New event'),
      event ? h('button', { class: 'btn btn-small', onclick: () => actions.duplicateEvent(event) }, 'Duplicate') : null
    )
  );

  if (!event) {
    return h('section', { class: 'panel' }, top, h('p', { class: 'muted' }, 'No events yet. Create one to start.'));
  }

  const isLive = event.id === settings.currentEventId;

  const form = h(
    'form',
    {
      class: 'stack',
      onsubmit: (e) => {
        e.preventDefault();
        actions.saveEvent(event.id, formValues(e.currentTarget));
      },
    },
    textField('Event title', 'title', event.title, { dir: 'auto', required: true }),
    h(
      'div',
      { class: 'grid-2' },
      textField('Date', 'date', event.date, { type: 'date' }),
      textField('Venue', 'venue', event.venue, { dir: 'auto' })
    ),
    textArea('Description (optional, shown on the home screen)', 'description', event.description, { dir: 'auto', rows: 2 }),
    checkbox('Published (visible to attendees)', 'published', event.published),
    h(
      'div',
      { class: 'btn-row' },
      h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save event'),
      h(
        'button',
        { class: 'btn btn-danger', type: 'button', onclick: () => actions.deleteEvent(event) },
        'Delete event'
      )
    )
  );

  const liveBox = isLive
    ? h(
        'div',
        { class: 'live-box is-live' },
        h('strong', {}, '● Live'),
        ' — attendees opening the link see this event.',
        event.published ? null : h('div', { class: 'warn' }, 'It is unpublished, so attendees currently see “no event”.')
      )
    : h(
        'div',
        { class: 'live-box' },
        'Not live. ',
        h('button', { class: 'btn btn-small btn-accent', onclick: () => actions.makeLive(event.id) }, 'Make this the live event')
      );

  return h('section', { class: 'panel' }, top, picker, liveBox, form);
}
