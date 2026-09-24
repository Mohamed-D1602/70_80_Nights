// Picks the admin backend for where the site is hosted:
// - on the Node server → password login, saves through /api/admin
// - on a static host (GitHub Pages) → GitHub token login, saves by committing
//   public/data/db.json
// Both backends export the same functions, so the admin UI doesn't care.

import { detectMode } from '../api.js';
import * as serverBackend from './serverBackend.js';
import * as githubBackend from './githubBackend.js';

export { AuthError } from './errors.js';

export async function getBackend() {
  return (await detectMode()) === 'server' ? serverBackend : githubBackend;
}
