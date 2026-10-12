import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS films (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('tmdb', 'manual')),
  title TEXT NOT NULL,
  original_title TEXT,
  release_date_fr TEXT,
  poster_url TEXT,
  directors TEXT NOT NULL DEFAULT '[]',
  cast_members TEXT NOT NULL DEFAULT '[]',
  genres TEXT NOT NULL DEFAULT '[]',
  runtime_min INTEGER,
  synopsis TEXT,
  trailers TEXT NOT NULL DEFAULT '[]',
  fetched_at TEXT
);
CREATE TABLE IF NOT EXISTS emissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  air_date TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS emission_films (
  emission_id INTEGER NOT NULL REFERENCES emissions(id) ON DELETE CASCADE,
  film_id TEXT NOT NULL REFERENCES films(id),
  position INTEGER NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('past', 'next')),
  notes TEXT NOT NULL DEFAULT '',
  score INTEGER CHECK (score IS NULL OR score BETWEEN 0 AND 10),
  trailer_key TEXT,
  PRIMARY KEY (emission_id, film_id)
);
CREATE TABLE IF NOT EXISTS live_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  emission_id INTEGER REFERENCES emissions(id) ON DELETE SET NULL,
  current_position INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'card' CHECK (mode IN ('card', 'full', 'trailer', 'off'))
);
INSERT OR IGNORE INTO live_state (id) VALUES (1);
`;

export function openDb(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
