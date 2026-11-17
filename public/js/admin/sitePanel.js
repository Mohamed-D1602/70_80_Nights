// Front-page text: the group's name, tagline, "about the idea" and founder.

import { h } from '../dom.js';
import { textField, textArea, formValues } from './fields.js';

export function SitePanel({ site, actions }) {
  return h(
    'details',
    { class: 'panel site-panel' },
    h('summary', { class: 'panel-head' }, h('h2', {}, 'Site text (front page)')),
    h(
      'form',
      {
        class: 'stack',
        onsubmit: (e) => {
          e.preventDefault();
          actions.saveSite(formValues(e.currentTarget));
        },
      },
      textField('Group name', 'name', site.name, { dir: 'auto', required: true }),
      textField('Tagline (big heading)', 'tagline', site.tagline, { dir: 'auto' }),
      textArea('About the idea (shown under “عن الفكرة”)', 'about', site.about, { dir: 'auto', rows: 10 }),
      textField('Founder / credit line', 'founder', site.founder, { dir: 'auto' }),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save site text'))
    )
  );
}
