import { h } from '../dom.js';
import { textField, checkbox, formValues } from './fields.js';

// `api` is the active backend (serverBackend or githubBackend).
export function renderLoginForm(container, { api, onLoggedIn }) {
  const error = h('p', { class: 'form-error', role: 'alert' });
  const button = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Log in');
  const fields = api.mode === 'github' ? githubFields(api.defaults()) : passwordFields();

  const form = h(
    'form',
    {
      class: 'login-card',
      onsubmit: async (e) => {
        e.preventDefault();
        error.textContent = '';
        button.disabled = true;
        button.textContent = 'Checking…';
        try {
          await api.login(formValues(e.currentTarget));
          onLoggedIn();
        } catch (err) {
          error.textContent = err.message;
        } finally {
          button.disabled = false;
          button.textContent = 'Log in';
        }
      },
    },
    h('h1', {}, '70/80 Nights — Admin'),
    fields,
    error,
    button
  );

  container.replaceChildren(h('div', { class: 'login-wrap' }, form));
  form.querySelector('input')?.focus();
}

function passwordFields() {
  return h(
    'label',
    { class: 'field' },
    h('span', {}, 'Admin password'),
    h('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true })
  );
}

function githubFields(d) {
  return h(
    'div',
    { class: 'stack' },
    h(
      'p',
      { class: 'muted small' },
      'This site is hosted on GitHub Pages, so saving works by updating the songs file in your GitHub repository. ',
      'Log in with a GitHub token (see the README, section “GitHub Pages”).'
    ),
    h(
      'label',
      { class: 'field' },
      h('span', {}, 'GitHub token'),
      h('input', { type: 'password', name: 'token', autocomplete: 'off', required: true, placeholder: 'github_pat_…' })
    ),
    h(
      'div',
      { class: 'grid-2' },
      textField('GitHub owner', 'owner', d.owner, { required: true, dir: 'ltr' }),
      textField('Repository', 'repo', d.repo, { required: true, dir: 'ltr' })
    ),
    h(
      'details',
      {},
      h('summary', { class: 'muted small' }, 'Advanced'),
      h(
        'div',
        { class: 'stack details-body' },
        textField('Branch (empty = repository default)', 'branch', d.branch, { dir: 'ltr' }),
        textField('Songs file path', 'path', d.path, { dir: 'ltr', required: true })
      )
    ),
    checkbox('Remember me on this device', 'remember', false)
  );
}
