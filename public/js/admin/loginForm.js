import { h } from '../dom.js';
import { login } from './adminApi.js';

export function renderLoginForm(container, { onLoggedIn }) {
  const error = h('p', { class: 'form-error', role: 'alert' });
  const input = h('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true });
  const button = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Log in');

  const form = h(
    'form',
    {
      class: 'login-card',
      onsubmit: async (e) => {
        e.preventDefault();
        error.textContent = '';
        button.disabled = true;
        try {
          await login(input.value);
          onLoggedIn();
        } catch (err) {
          error.textContent = err.message;
          input.select();
        } finally {
          button.disabled = false;
        }
      },
    },
    h('h1', {}, '70/80 Nights — Admin'),
    h('label', { class: 'field' }, h('span', {}, 'Admin password'), input),
    error,
    button
  );

  container.replaceChildren(h('div', { class: 'login-wrap' }, form));
  input.focus();
}
