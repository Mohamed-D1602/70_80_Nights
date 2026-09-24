# 70/80 Nights — Sing-along lyrics app

A small web app for a monthly sing-along night of classic Sudanese songs from the 1970s and 1980s. Attendees scan a QR code at the venue and follow the lyrics on their phones. You manage each month's song list and lyrics from an admin page, with no code changes.

- **Attendee view (`/`)**: Arabic RTL layout, dark theme by default, large high-contrast lyrics. Songs are navigated by swipe, next/previous buttons, or arrow keys. No login.
- **Admin page (`/admin`)**: protected by one password. Add, edit, reorder, and delete songs. Manage several monthly events and choose which one is live. Download and restore backups.

## Features

| Area | What it does |
|---|---|
| Playlist | The home screen lists the live event's songs with title, artist, and a cover image or a numbered placeholder. |
| Lyrics | Large Arabic text (Noto Naskh Arabic), stanza spacing, section labels, and a highlighted chorus so people know when to join in. |
| Navigation | Next/previous buttons, swipe (RTL: swipe right for the next song, like turning an Arabic page), ←/→ keys, and a "next song" card at the end of each song. |
| Comfort | Font size A-/A+ and a dark/light toggle, remembered on each phone. The screen stays on while lyrics are open (Wake Lock API, where supported). |
| Venue Wi-Fi | A service worker caches the app and lyrics after the first load. If the connection drops, phones keep showing the last loaded lyrics. |
| Live edits | Phones re-check for changes every 60 seconds and whenever the tab comes back into view. A typo fixed in admin appears without a reload. |
| Admin | Events (title, date, venue, description, published flag), a "make live" switch, a song editor with a live phone preview, ↑/↓ reordering, event duplication to start next month's list, and JSON backup/restore. |

## Quick start (local)

Requirements: **Node.js 22 or newer** (`node -v`).

```bash
git clone <your repo url> 70_80_Nights
cd 70_80_Nights
npm install
cp .env.example .env        # then edit .env and set ADMIN_PASSWORD
npm start                   # or: npm run dev (auto-restarts on code changes)
```

- Attendee view: http://localhost:3000
- Admin: http://localhost:3000/admin (log in with `ADMIN_PASSWORD`)

On first start the app creates `data/db.json` from `data/seed.json`, which holds **placeholder** songs. Replace them in the admin page.

To try it on your phone over the same Wi-Fi, open `http://<your-computer's-LAN-IP>:3000`.

Run the tests with `npm test`.

## Preparing each month's event

1. Open `/admin` and log in.
2. Either click **Duplicate** on last month's event (it copies all songs, unpublished) or **+ New event**.
3. Set the title, date, and venue, then click **Save event**.
4. Add songs with **+ Add song**. Type or paste the lyrics and check the **Phone preview** beside the editor.
5. Put the songs in performance order with the ↑/↓ buttons.
6. Tick **Published** and click **Make this the live event**. Everyone who opens the link now sees this event.
7. Click **Download backup** and keep the file somewhere safe.

### Lyrics format

```
[المقطع الأول]
first sung line
second sung line

[الكورس]
chorus line one
chorus line two
```

- One sung line per line. A blank line starts a new stanza.
- A name in `[square brackets]` on its own line becomes a small section heading.
- Sections whose name contains **كورس / الكورس / كوراس / اللازمة / chorus / refrain** are highlighted.

### Cover images

Paste any public `https://` image URL, or leave the field empty to get a coloured tile with the song number. You can also put images in `public/covers/` and use `/covers/my-image.jpg` (this requires a redeploy).

## Deploying

The server is one Node.js process that stores everything in `DATA_DIR/db.json`. **That file must live on persistent storage.** Many hosts wipe the app's filesystem on each deploy or restart, which would erase your songs.

| Variable | Required | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | yes | Password for `/admin`. The admin page stays locked if it is empty. |
| `SESSION_SECRET` | recommended | Long random string that signs admin logins. If unset, admins are logged out whenever the server restarts. |
| `DATA_DIR` | on hosts | Folder for `db.json`. Point it at a mounted disk or volume. |
| `PORT` | no | Most hosts set this for you. |

Generate a secret with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Option A — Render / Railway / Fly.io (managed)

1. Push this repo to GitHub.
2. Create a new **Web Service** from the repo.
   - Build command: `npm install`
   - Start command: `npm start`
3. Add the environment variables above.
4. Attach a **persistent disk / volume** (for example mounted at `/data`) and set `DATA_DIR=/data`.
   - Render: persistent disks are only on paid instance types. On the free tier, data is lost on every restart.
   - Railway: add a Volume to the service.
   - Fly.io: `fly volumes create data`, then mount it in `fly.toml`.

Check each provider's current pricing and disk options before choosing; they change often.

### Option B — Docker (any VPS)

```bash
docker build -t nights .
docker run -d --name nights -p 80:3000 \
  -e ADMIN_PASSWORD='your-password' \
  -e SESSION_SECRET='long-random-string' \
  -v nights-data:/data \
  --restart unless-stopped nights
```

Put it behind HTTPS (for example Caddy or Nginx with Let's Encrypt). HTTPS is needed for the offline cache and keep-screen-on features, and it protects the admin password.

### Option C — Plain VPS with Node

```bash
npm ci --omit=dev
ADMIN_PASSWORD=... SESSION_SECRET=... DATA_DIR=/var/lib/nights npx pm2 start server/index.js --name nights
```

### QR code for the venue

Make a QR code that points to your public URL (the admin page's **Copy attendee link** button gives it to you) with any QR generator, then print it for the tables. The link stays the same every month, because it always shows whichever event is live.

## Project structure

```
server/
  index.js        Starts the server (reads .env)
  app.js          Express app: public API, admin API, static files
  store.js        JSON-file database with validation and atomic writes
  auth.js         Admin password check, signed expiring tokens, login rate limit
public/
  index.html      Attendee app shell (lang="ar" dir="rtl")
  admin.html      Admin shell
  css/app.css     Attendee styles and theme tokens (dark/light)
  css/admin.css   Admin styles
  sw.js           Service worker (offline cache)
  js/
    app.js                     Attendee entry point: loading, refresh, hash router
    api.js                     Public API calls
    lyrics.js                  Lyrics text → stanzas parser (shared with admin preview)
    prefs.js                   Font size and theme, saved per device
    wakeLock.js                Keeps the screen on
    dom.js, icons.js           Small DOM helpers (no innerHTML for user data)
    components/songList.js     Playlist view
    components/lyricsViewer.js Lyrics view, swipe/keyboard navigation
    admin/                     Admin panel (login, events, songs list, song editor)
data/
  seed.json       Placeholder content used on first run
test/             API and parser tests (node:test)
```

There is no build step. The frontend is plain ES modules, so you can edit a file and reload.

### API

Public (no auth):

- `GET /api/events/current`: the live event with its songs
- `GET /api/events`: summaries of all published events
- `GET /api/events/:id`: one published event

Admin (header `Authorization: Bearer <token>` from `POST /api/admin/login {password}`):

- `GET /api/admin/state`
- `POST /api/admin/events`, `PUT /api/admin/events/:id`, `DELETE /api/admin/events/:id`
- `PUT /api/admin/settings/current-event {eventId}`
- `POST /api/admin/events/:id/songs`, `PUT|DELETE /api/admin/events/:id/songs/:songId`
- `PUT /api/admin/events/:id/songs/order {songIds}`
- `GET /api/admin/export`, `POST /api/admin/import`

## Extending it later

- **Past events archive or event picker**: `GET /api/events` already lists published events. Add a `#/events` route in `public/js/app.js` that uses `fetchEvent(id)`.
- **Song search**: filter `event.songs` in `components/songList.js`, or search every event using `/api/events`.
- **Synced scrolling with the live performance**: the parser already produces stanzas. A "conductor" page in admin could send the current stanza index to phones, polled or over Server-Sent Events, and the viewer could highlight and scroll to it.
- **Image uploads**: add an upload endpoint (for example with `multer`) that saves into `DATA_DIR/covers`.
- **Bigger scale or multiple admins**: swap `server/store.js` for SQLite or Postgres behind the same methods. The routes in `app.js` won't need to change.

## Notes

- The seed songs are placeholders. Only publish lyrics you have the right to share: most songs from this era are still under copyright held by the writers, composers, or their estates.
- Fonts come from Google Fonts. If they can't load, the app falls back to the device's Arabic system font.
