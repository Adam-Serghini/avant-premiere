import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { BASE_SCHEMA, MIGRATIONS, openDb, SCHEMA_VERSION } from './db';
import { createRepo } from './repo';

let tmp: string | null = null;
afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = null;
});

/** Crée une base au format v1, telle que la v1 publiée la laisse sur le disque. */
function v1File(): string {
  tmp = mkdtempSync(join(tmpdir(), 'avant-premiere-db-'));
  const file = join(tmp, 'v1.db');
  const raw = new Database(file);
  raw.exec(BASE_SCHEMA);
  raw.exec(`
    INSERT INTO films (id, source, title) VALUES ('tmdb:1', 'tmdb', 'Film 1');
    INSERT INTO emissions (air_date, created_at) VALUES ('2026-10-13', '2026-10-07T10:00:00.000Z');
    INSERT INTO emission_films (emission_id, film_id, position, period, notes, score)
      VALUES (1, 'tmdb:1', 0, 'past', 'Superbe film', 8);
    UPDATE live_state SET emission_id = 1, current_position = 0, mode = 'card' WHERE id = 1;
  `);
  raw.close();
  return file;
}

const columns = (db: Database.Database, table: string) =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

describe('migrations', () => {
  it('migre une base v1 sans perdre les notes', () => {
    const db = openDb(v1File());
    const ef = createRepo(db).getEmission('2026-10-13').films[0];
    expect(ef).toMatchObject({ opinion: 'Superbe film', anecdotes: '', extendedUniverse: '', score: 8 });
    expect(columns(db, 'emission_films')).not.toContain('notes');
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
    db.close();
  });

  it('rouvre une base déjà migrée sans rien changer', () => {
    const file = v1File();
    openDb(file).close();
    const db = openDb(file);
    expect(createRepo(db).getEmission('2026-10-13').films[0]?.opinion).toBe('Superbe film');
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
    db.close();
  });

  it('remplace le mode Carte par la Fiche', () => {
    const db = openDb(v1File());
    expect(createRepo(db).getLiveState()).toMatchObject({ emissionId: 1, mode: 'full' });
    expect(() => db.prepare("UPDATE live_state SET mode = 'card' WHERE id = 1").run()).toThrow();
    db.close();
  });

  it('la migration 7 range les films par partie sans rien perdre', () => {
    tmp = mkdtempSync(join(tmpdir(), 'avant-premiere-db-'));
    const file = join(tmp, 'v6.db');
    const raw = new Database(file);
    raw.exec(BASE_SCHEMA);
    MIGRATIONS.slice(0, 6).forEach((step) => step(raw));
    raw.pragma('user_version = 6');
    raw.exec("INSERT INTO emissions (air_date, created_at) VALUES ('2026-10-13', '2026-10-07T10:00:00.000Z')");
    ['A', 'B', 'C', 'D'].forEach((t, i) => {
      raw.exec(`INSERT INTO films (id, source, title) VALUES ('tmdb:${t}', 'tmdb', 'Film ${t}')`);
      raw.exec(`INSERT INTO emission_films (emission_id, film_id, position, period, opinion)
        VALUES (1, 'tmdb:${t}', ${i}, '${t === 'A' || t === 'C' ? 'next' : 'past'}', 'avis ${t}')`);
    });
    raw.close();
    const db = openDb(file);
    const films = createRepo(db).getEmission('2026-10-13').films;
    expect(films.map((f) => [f.film.title, f.section, f.position, f.opinion])).toEqual([
      ['Film B', 'seen', 0, 'avis B'],
      ['Film D', 'seen', 1, 'avis D'],
      ['Film A', 'releases', 2, 'avis A'],
      ['Film C', 'releases', 3, 'avis C'],
    ]);
    expect(columns(db, 'emission_films')).not.toContain('period');
    expect(db.pragma('user_version', { simple: true })).toBe(7);
    db.close();
  });

  it('amène une base neuve à la dernière version', () => {
    const db = openDb(':memory:');
    expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
    expect(columns(db, 'emission_films')).toEqual(
      expect.arrayContaining(['opinion', 'anecdotes', 'extended_universe']),
    );
    expect(columns(db, 'settings')).toEqual(['key', 'value']);
    expect(columns(db, 'films')).toEqual(expect.arrayContaining(['custom_poster', 'local_trailer', 'overrides', 'imdb_id', 'ratings']));
  });
});
