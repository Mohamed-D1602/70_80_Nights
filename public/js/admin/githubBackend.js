// Admin backend for GitHub Pages (no server). The songs live in
// public/data/db.json in the repository. This backend loads that file with
// the GitHub API, edits it in memory using the same logic as the server
// (js/shared/db.js), and saves each change as a commit. GitHub Pages then
// redeploys the site, usually within a minute or two.
//
// Login is a fine-grained personal access token limited to this one
// repository with "Contents: Read and write". It is sent only to
// api.github.com.

import { Db } from '../shared/db.js';
import { AuthError } from './errors.js';

export const mode = 'github';

const TOKEN_KEY = 'nights.githubToken';
const SETTINGS_KEY = 'nights.githubRepo';
const DEFAULT_PATH = 'public/data/db.json';
const API = 'https://api.github.com';

let token = null;
let repo = null; // { owner, repo, branch, path }
let db = null;
let sha = null; // blob sha of the file we last read/wrote (null = file doesn't exist yet)
let queue = Promise.resolve();

class ConflictError extends Error {}

// ---------- storage ----------

function storageGet(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(store, key, value) {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function savedToken() {
  return storageGet(sessionStorage, TOKEN_KEY) || storageGet(localStorage, TOKEN_KEY);
}

function savedRepo() {
  try {
    return JSON.parse(storageGet(localStorage, SETTINGS_KEY) || 'null');
  } catch {
    return null;
  }
}

// Best guess from the URL: https://<owner>.github.io/<repo>/...
export function defaults() {
  const saved = savedRepo();
  if (saved) return saved;
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
  const first = location.pathname.split('/').filter(Boolean)[0] || '';
  const owner = m ? m[1] : '';
  const name = m ? (first && !first.includes('.') ? first : `${owner}.github.io`) : '';
  return { owner, repo: name, branch: '', path: DEFAULT_PATH };
}

export function isLoggedIn() {
  return Boolean(savedToken() && savedRepo());
}

export function repoInfo() {
  return repo || savedRepo();
}

// ---------- GitHub API ----------

async function gh(method, path, body) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      cache: 'no-store', // never reuse a cached file sha
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Could not reach GitHub. Check your internet connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;
  if (res.status === 401) throw new AuthError('GitHub rejected the token (expired or mistyped). Please log in again.');
  if (res.status === 409 || (res.status === 422 && /sha/i.test(data.message || ''))) {
    throw new ConflictError(data.message || 'Conflict');
  }
  const err = new Error(
    res.status === 403 || res.status === 404
      ? `GitHub said "${data.message || res.status}". Check that the token has access to ${repo.owner}/${repo.repo} with "Contents: Read and write" permission.`
      : `GitHub error ${res.status}: ${data.message || 'unknown error'}`
  );
  err.status = res.status;
  throw err;
}

const contentsPath = () =>
  `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/contents/${repo.path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

function b64encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function loadFile() {
  try {
    const file = await gh('GET', `${contentsPath()}?ref=${encodeURIComponent(repo.branch)}`);
    db = new Db(JSON.parse(b64decode(file.content)));
    sha = file.sha;
  } catch (err) {
    if (err.status !== 404) throw err;
    db = new Db({ settings: { currentEventId: null }, events: [] }); // created on first save
    sha = null;
  }
}

async function commit(message) {
  const body = {
    message,
    content: b64encode(`${JSON.stringify(db.toJSON(), null, 2)}\n`),
    branch: repo.branch,
    ...(sha ? { sha } : {}),
  };
  const res = await gh('PUT', contentsPath(), body);
  sha = res.content.sha;
}

// Apply a change in memory, then commit it. Changes run one at a time so each
// commit is based on the previous one. If the commit fails the in-memory
// change is rolled back; if the file was changed elsewhere (someone else
// saved, or it was edited on github.com), the latest version is reloaded.
function mutate(message, change) {
  const run = async () => {
    await ensureLoaded();
    const before = JSON.stringify(db.toJSON());
    const result = change(db); // may throw (e.g. invalid backup file)
    if (result === null || result === false) throw new Error('That item no longer exists. Reload the page.');
    try {
      await commit(typeof message === 'function' ? message(result) : message);
    } catch (err) {
      if (err instanceof ConflictError) {
        await loadFile();
        throw new Error('The songs file was changed somewhere else, so the latest version was loaded. Please redo your last change.');
      }
      db = new Db(JSON.parse(before));
      throw err;
    }
    return clone(result);
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

async function ensureLoaded() {
  if (db) return;
  token = savedToken();
  repo = savedRepo();
  if (!token || !repo) throw new AuthError('Please log in.');
  await loadFile();
}

const clone = (v) => (v && typeof v === 'object' ? structuredClone(v) : v);

// ---------- public interface (same as serverBackend.js) ----------

export async function login({ token: newToken, owner, repo: name, branch, path, remember }) {
  token = String(newToken || '').trim();
  if (!token) throw new Error('Paste your GitHub token.');
  repo = { owner: owner.trim(), repo: name.trim(), branch: (branch || '').trim(), path: (path || DEFAULT_PATH).trim() };
  if (!repo.owner || !repo.repo) throw new Error('Fill in the GitHub owner and repository name.');

  // Checks the token and repo, and finds the branch if left empty.
  const info = await gh('GET', `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`);
  if (!repo.branch) repo.branch = info.default_branch;
  await loadFile();

  storageSet(sessionStorage, TOKEN_KEY, token);
  storageSet(localStorage, TOKEN_KEY, remember ? token : null);
  storageSet(localStorage, SETTINGS_KEY, JSON.stringify(repo));
}

export function logout() {
  storageSet(sessionStorage, TOKEN_KEY, null);
  storageSet(localStorage, TOKEN_KEY, null);
  token = null;
  db = null;
  sha = null;
}

export async function getState() {
  await queue;
  await ensureLoaded();
  return clone({ settings: db.getSettings(), events: db.listEvents() });
}

export const createEvent = (fields) => mutate((e) => `Add event: ${e.title}`, (d) => d.createEvent(fields));
export const duplicateEvent = (id) => mutate((e) => `Duplicate event: ${e.title}`, (d) => d.duplicateEvent(id));
export const updateEvent = (id, fields) => mutate((e) => `Update event: ${e.title}`, (d) => d.updateEvent(id, fields));
export const deleteEvent = (id) => mutate('Delete event', (d) => d.deleteEvent(id));
export const setCurrentEvent = (eventId) =>
  mutate('Change live event', (d) => (d.setCurrentEvent(eventId) ? d.getSettings() : null));
export const addSong = (eventId, fields) => mutate((s) => `Add song: ${s.title}`, (d) => d.addSong(eventId, fields));
export const updateSong = (eventId, songId, fields) =>
  mutate((s) => `Update song: ${s.title}`, (d) => d.updateSong(eventId, songId, fields));
export const deleteSong = (eventId, songId) => mutate('Delete song', (d) => d.deleteSong(eventId, songId));
export const reorderSongs = (eventId, songIds) => mutate('Reorder songs', (d) => d.reorderSongs(eventId, songIds));

export async function exportBackup() {
  return getState();
}

export const importBackup = (data) =>
  mutate('Restore backup', (d) => {
    d.replaceAll(data);
    return true;
  });
