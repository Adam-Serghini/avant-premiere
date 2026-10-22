import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Film } from '../shared/types';
import { openDb } from './db';
import { createRepo, RepoError, type Repo } from './repo';

function film(id: string, overrides: Partial<Film> = {}): Film {
  return {
    id,
    source: 'tmdb',
    title: `Film ${id}`,
    originalTitle: null,
    releaseDateFr: '2026-10-14',
    posterUrl: null,
    directors: ['Réalisatrice X'],
    cast: ['Acteur A'],
    genres: ['Drame'],
    runtimeMin: 100,
    synopsis: null,
    trailers: [
      { key: 'enTrailer01', name: 'Trailer', lang: 'en', type: 'Trailer' },
      { key: 'frTrailer01', name: 'Bande-annonce', lang: 'fr', type: 'Trailer' },
    ],
    fetchedAt: '2026-10-07T10:00:00.000Z',
    ...overrides,
  };
}

const DATE = '2026-10-13';

function setup(): Repo {
  const repo = createRepo(openDb(':memory:'));
  for (const id of ['tmdb:1', 'tmdb:2', 'tmdb:3']) repo.upsertFilm(film(id));
  return repo;
}

const ids = (repo: Repo) => repo.getEmission(DATE).films.map((f) => f.film.id);

describe('repo', () => {
  let tmp: string | null = null;
  afterEach(() => {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
    tmp = null;
  });

  it('enregistre et met à jour une fiche', () => {
    const repo = setup();
    expect(repo.getFilm('tmdb:1')).toEqual(film('tmdb:1'));
    repo.upsertFilm(film('tmdb:1', { title: 'Nouveau titre' }));
    expect(repo.getFilm('tmdb:1')?.title).toBe('Nouveau titre');
    expect(repo.getFilm('tmdb:404')).toBeNull();
  });

  it('crée l’émission une seule fois', () => {
    const repo = setup();
    const a = repo.getEmission(DATE);
    expect(a).toEqual({ id: a.id, airDate: DATE, films: [] });
    expect(repo.getEmission(DATE).id).toBe(a.id);
    expect(repo.getEmissionById(a.id)?.airDate).toBe(DATE);
    expect(repo.getEmissionById(999)).toBeNull();
  });

  it('ajoute les films à la suite, avec la VF par défaut', () => {
    const repo = setup();
    repo.addFilm(DATE, 'tmdb:1', 'past');
    const e = repo.addFilm(DATE, 'tmdb:2', 'next');
    expect(e.films.map((f) => [f.film.id, f.position, f.period])).toEqual([
      ['tmdb:1', 0, 'past'],
      ['tmdb:2', 1, 'next'],
    ]);
    expect(e.films[0]).toMatchObject({
      opinion: '',
      anecdotes: '',
      extendedUniverse: '',
      score: null,
      trailerKey: 'frTrailer01',
    });
  });

  it('ignore un ajout en double', () => {
    const repo = setup();
    repo.addFilm(DATE, 'tmdb:1', 'past');
    expect(repo.addFilm(DATE, 'tmdb:1', 'past').films).toHaveLength(1);
  });

  it('refuse un film inconnu', () => {
    expect(() => setup().addFilm(DATE, 'tmdb:404', 'past')).toThrow(RepoError);
  });

  it('retire un film et renumérote', () => {
    const repo = setup();
    repo.addFilm(DATE, 'tmdb:1', 'past');
    repo.addFilm(DATE, 'tmdb:2', 'past');
    repo.addFilm(DATE, 'tmdb:3', 'next');
    const e = repo.removeFilm(DATE, 'tmdb:2');
    expect(e.films.map((f) => [f.film.id, f.position])).toEqual([
      ['tmdb:1', 0],
      ['tmdb:3', 1],
    ]);
    expect(repo.removeFilm(DATE, 'tmdb:2').films).toHaveLength(2);
  });

  it('modifie les sections de notes, la note et la bande-annonce', () => {
    const repo = setup();
    repo.addFilm(DATE, 'tmdb:1', 'past');
    repo.updateFilm(DATE, 'tmdb:1', { opinion: 'Superbe', anecdotes: 'Tourné en Islande', score: 8 });
    repo.updateFilm(DATE, 'tmdb:1', { extendedUniverse: 'Roman de 1862' });
    const e = repo.updateFilm(DATE, 'tmdb:1', { trailerKey: 'enTrailer01' });
    expect(e.films[0]).toMatchObject({
      opinion: 'Superbe',
      anecdotes: 'Tourné en Islande',
      extendedUniverse: 'Roman de 1862',
      score: 8,
      trailerKey: 'enTrailer01',
    });
    expect(repo.updateFilm(DATE, 'tmdb:1', { score: null }).films[0]!.score).toBeNull();
  });

  it('refuse une note invalide ou un film absent de l’émission', () => {
    const repo = setup();
    repo.addFilm(DATE, 'tmdb:1', 'past');
    expect(() => repo.updateFilm(DATE, 'tmdb:1', { score: 11 })).toThrow(/0 et 10/);
    expect(() => repo.updateFilm(DATE, 'tmdb:1', { score: 2.5 })).toThrow(RepoError);
    expect(() => repo.updateFilm(DATE, 'tmdb:2', { opinion: 'x' })).toThrow(RepoError);
  });

  it('réordonne le conducteur', () => {
    const repo = setup();
    repo.addFilm(DATE, 'tmdb:1', 'past');
    repo.addFilm(DATE, 'tmdb:2', 'past');
    repo.addFilm(DATE, 'tmdb:3', 'next');
    repo.reorder(DATE, ['tmdb:3', 'tmdb:1', 'tmdb:2']);
    expect(ids(repo)).toEqual(['tmdb:3', 'tmdb:1', 'tmdb:2']);
  });

  it('refuse un ordre qui ne contient pas exactement les films retenus', () => {
    const repo = setup();
    repo.addFilm(DATE, 'tmdb:1', 'past');
    repo.addFilm(DATE, 'tmdb:2', 'past');
    expect(() => repo.reorder(DATE, ['tmdb:1'])).toThrow(RepoError);
    expect(() => repo.reorder(DATE, ['tmdb:1', 'tmdb:1'])).toThrow(RepoError);
    expect(() => repo.reorder(DATE, ['tmdb:1', 'tmdb:3'])).toThrow(RepoError);
  });

  it('conserve l’état du live après réouverture de la base', () => {
    tmp = mkdtempSync(join(tmpdir(), 'avant-premiere-'));
    const file = join(tmp, 'test.db');
    const db = openDb(file);
    const repo = createRepo(db);
    expect(repo.getLiveState()).toEqual({ emissionId: null, airDate: null, position: 0, mode: 'full' });
    const e = repo.getEmission(DATE);
    repo.saveLiveState({ emissionId: e.id, airDate: DATE, position: 2, mode: 'full' });
    db.close();
    const db2 = openDb(file);
    expect(createRepo(db2).getLiveState()).toEqual({ emissionId: e.id, airDate: DATE, position: 2, mode: 'full' });
    db2.close();
  });
});
