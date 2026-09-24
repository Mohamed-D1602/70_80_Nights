const path = require('path');

// Load .env if present (Node >= 20.12 has this built in; no dotenv needed).
try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
  /* no .env file — rely on real environment variables */
}

const { createApp } = require('./app');

const port = Number(process.env.PORT) || 3000;
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));

const app = createApp({
  dataDir,
  adminPassword: process.env.ADMIN_PASSWORD || '',
  sessionSecret: process.env.SESSION_SECRET || '',
});

app.listen(port, () => {
  console.log(`70/80 Nights running at http://localhost:${port}`);
  console.log(`Admin page:            http://localhost:${port}/admin`);
  console.log(`Data file:             ${path.join(dataDir, 'db.json')}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('WARNING: ADMIN_PASSWORD is not set — the admin page is locked. See .env.example.');
  }
});
