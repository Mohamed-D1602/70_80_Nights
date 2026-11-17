// Front-page text: name, tagline, the idea, how an evening goes, join us, credit.

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
      textArea('The idea (section “الفكرة”)', 'about', site.about, { dir: 'auto', rows: 6 }),
      textArea('How an evening goes (section “كيف تكون الليلة؟”): one card per line, written as  title | description', 'highlights', site.highlights, {
        dir: 'auto',
        rows: 5,
      }),
      textArea(
        'Photos (section “صور من السودان”): one per line, written as  image link | caption | credit. Use https:// links or files uploaded to public/photos/ (e.g. photos/nile.jpg). Only use photos you have the right to share.',
        'photos',
        site.photos,
        { dir: 'auto', rows: 4 }
      ),
      textArea('Join us (section “شارك معنا”)', 'join', site.join, { dir: 'auto', rows: 3 }),
      textField('Contact line (optional: phone, WhatsApp or email shown publicly)', 'contact', site.contact, { dir: 'auto' }),
      textField('Founder / credit line (page footer)', 'founder', site.founder, { dir: 'auto' }),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save site text'))
    )
  );
}
