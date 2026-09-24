// JSON-file persistence for the Node server.
//
// All data lives in one file (<DATA_DIR>/db.json). That is plenty for a
// monthly event with a few dozen songs, needs no database server, and the
// file doubles as a human-readable backup. Writes are atomic (write to a
// temp file, then rename) so a crash mid-write cannot corrupt the data.
//
// The editing logic itself is shared with the browser (GitHub Pages mode)
// in public/js/shared/db.js.

const fs = require('fs');
const path = require('path');
const { Db } = require('../public/js/shared/db.js');

// The same file the GitHub Pages version reads, so a fresh server starts
// with whatever is committed in the repo.
const SEED_FILE = path.join(__dirname, '..', 'public', 'data', 'db.json');

function openStore(dataDir) {
  const file = path.join(dataDir, 'db.json');
  fs.mkdirSync(dataDir, { recursive: true });

  const save = (data) => {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  };

  const exists = fs.existsSync(file);
  const source = exists ? file : SEED_FILE;
  const raw = fs.existsSync(source)
    ? JSON.parse(fs.readFileSync(source, 'utf8'))
    : { settings: { currentEventId: null }, events: [] };

  const db = new Db(raw, { onChange: save });
  if (!exists) save(db.toJSON());
  return db;
}

module.exports = { openStore };
