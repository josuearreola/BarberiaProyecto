import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('../../node_modules/pg');

const envPath = path.resolve(process.cwd(), 'backend/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!match) throw new Error('DATABASE_URL not found in backend/.env');

const dbUrl = match[1].trim().replace(/^['"]|['"]$/g, '');
const u = new URL(dbUrl);

const client = new Client({
  host: u.hostname,
  port: u.port ? Number(u.port) : 5432,
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, ''),
  ssl: { rejectUnauthorized: false, servername: u.hostname },
  connectionTimeoutMillis: 15000,
});

await client.connect();
const cnt = await client.query('SELECT COUNT(*)::int AS total FROM appointments');
const idx = await client.query(
  `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'appointments' ORDER BY indexname`,
);
const ext = await client.query(`SELECT extname FROM pg_extension WHERE extname IN ('pg_trgm', 'btree_gin')`);
console.log(JSON.stringify({ totalAppointments: cnt.rows[0].total, indexes: idx.rows, extensions: ext.rows }, null, 2));
await client.end();
