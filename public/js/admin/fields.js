// Small form-field builders shared by the admin editors.

import { h } from '../dom.js';

export function textField(label, name, value, attrs = {}) {
  return h('label', { class: 'field' }, h('span', {}, label), h('input', { type: 'text', name, value: value ?? '', ...attrs }));
}

export function textArea(label, name, value, attrs = {}) {
  const ta = h('textarea', { name, ...attrs });
  ta.value = value ?? '';
  return h('label', { class: 'field' }, h('span', {}, label), ta);
}

export function checkbox(label, name, checked) {
  return h('label', { class: 'check' }, h('input', { type: 'checkbox', name, checked: Boolean(checked) }), h('span', {}, label));
}

// Read a form's named fields into a plain object (checkboxes → booleans).
export function formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return out;
}
