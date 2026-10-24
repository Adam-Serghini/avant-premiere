import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { selectTrailers } from '../shared/trailer';
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
    customPosterUrl: null,
    localTrailerUrl: null,
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
    editedFields: [],
    imdbId: null,
    ratings: null,
    ...overrides,
  };
}

/** La fiche telle que le repo la rend : la VO s'efface quand une VF existe. */
const shown = (f: Film): Film => ({ ...f, trailers: selectTrailers(f.trailers) });

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
    expect(repo.getFilm('tmdb:1')).toEqual(shown(film('tmdb:1')));
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

  it('garde l’affiche et la vidéo choisies quand la fiche est mise à jour', () => {
    const repo = setup();
    repo.setFilmMedia('tmdb:1', 'poster', '/media/a.jpg');
    repo.setFilmMedia('tmdb:1', 'trailer', '/media/b.mp4');
    repo.upsertFilm(film('tmdb:1', { title: 'Titre TMDB' }));
    expect(repo.getFilm('tmdb:1')).toMatchObject({
      title: 'Titre TMDB',
      customPosterUrl: '/media/a.jpg',
      localTrailerUrl: '/media/b.mp4',
    });
    expect(() => repo.setFilmMedia('tmdb:404', 'poster', null)).toThrow(RepoError);
  });
});

describe('corrections de fiche', () => {
  const extra = { key: 'zzz', name: 'Bande-annonce ajoutée', lang: 'fr', type: 'Trailer' } as const;
  const candidate = (f: Film, o: Record<string, unknown> = {}) => ({
    title: f.title, releaseDateFr: f.releaseDateFr, directors: f.directors, cast: f.cast, genres: f.genres,
    runtimeMin: f.runtimeMin, synopsis: f.synopsis, extraTrailer: undefined, ...o,
  });

  it('applique une correction sur la fiche TMDB', () => {
    const repo = setup();
    const edited = repo.editFilm('tmdb:1', candidate(film('tmdb:1'), { cast: ['Иван Иванов'] }));
    expect(edited.cast).toEqual(['Иван Иванов']);
    expect(edited.editedFields).toEqual(['cast']);
    expect(repo.getFilm('tmdb:1')).toEqual(edited);
    expect(repo.getFilm('tmdb:2')?.editedFields).toEqual([]);
  });

  it('garde la correction quand TMDB actualise la fiche', () => {
    const repo = setup();
    repo.editFilm('tmdb:1', candidate(film('tmdb:1'), { cast: ['Ivan Ivanov'] }));
    repo.upsertFilm(film('tmdb:1', { synopsis: 'Nouveau résumé', cast: ['Иван'] }));
    const f = repo.getFilm('tmdb:1')!;
    expect(f.synopsis).toBe('Nouveau résumé');
    expect(f.cast).toEqual(['Ivan Ivanov']);
    expect(f.editedFields).toEqual(['cast']);
  });

  it('retire la correction quand la valeur revient à celle de TMDB', () => {
    const repo = setup();
    repo.editFilm('tmdb:1', candidate(film('tmdb:1'), { cast: ['B'], title: 'T' }));
    const f = repo.editFilm('tmdb:1', candidate(film('tmdb:1'), { cast: ['Acteur A'], title: 'T' }));
    expect(f.cast).toEqual(['Acteur A']);
    expect(f.editedFields).toEqual(['title']);
  });

  it('ajoute la bande-annonce saisie sans doublon', () => {
    const repo = setup();
    const f = repo.editFilm('tmdb:1', candidate(film('tmdb:1'), { extraTrailer: extra }));
    expect(f.trailers.map((t) => t.key)).toEqual(['frTrailer01', 'zzz']);
    expect(f.editedFields).toEqual(['extraTrailer']);
    repo.upsertFilm(film('tmdb:1', { trailers: [...film('tmdb:1').trailers, { ...extra }] }));
    expect(repo.getFilm('tmdb:1')?.trailers.map((t) => t.key)).toEqual(['frTrailer01', 'zzz']);
  });

  it('enregistre l’identifiant IMDb avec la fiche', () => {
    const repo = setup();
    repo.upsertFilm(film('tmdb:1', { imdbId: 'tt1234567' }));
    expect(repo.getFilm('tmdb:1')?.imdbId).toBe('tt1234567');
  });

  describe('notes', () => {
    const ratings = { imdb: 7.4, rottenTomatoes: 85, metacritic: null };

    it('enregistre et relit les notes, puis les efface', () => {
      const repo = setup();
      repo.setFilmRatings('tmdb:1', ratings);
      expect(repo.getFilm('tmdb:1')?.ratings).toEqual(ratings);
      repo.setFilmRatings('tmdb:1', null);
      expect(repo.getFilm('tmdb:1')?.ratings).toBeNull();
    });

    it('survivent à une actualisation TMDB', () => {
      const repo = setup();
      repo.setFilmRatings('tmdb:1', ratings);
      repo.upsertFilm(film('tmdb:1', { title: 'Autre titre', imdbId: 'tt9' }));
      expect(repo.getFilm('tmdb:1')).toMatchObject({ title: 'Autre titre', imdbId: 'tt9', ratings });
    });

    it('lisent un JSON abîmé comme une absence de notes', () => {
      const db = openDb(':memory:');
      const repo = createRepo(db);
      repo.upsertFilm(film('tmdb:1'));
      db.prepare('UPDATE films SET ratings = ? WHERE id = ?').run('{pas du json', 'tmdb:1');
      expect(repo.getFilm('tmdb:1')?.ratings).toBeNull();
      db.prepare('UPDATE films SET ratings = ? WHERE id = ?').run('"texte"', 'tmdb:1');
      expect(repo.getFilm('tmdb:1')?.ratings).toBeNull();
    });

    it('refusent un film inconnu', () => {
      expect(() => setup().setFilmRatings('tmdb:404', ratings)).toThrow(RepoError);
    });
  });

  it('efface les corrections', () => {
    const repo = setup();
    repo.editFilm('tmdb:1', candidate(film('tmdb:1'), { cast: ['B'], extraTrailer: extra }));
    expect(repo.clearFilmOverrides('tmdb:1')).toEqual(shown(film('tmdb:1')));
  });

  it('signale une fiche inconnue', () => {
    const repo = setup();
    expect(() => repo.editFilm('tmdb:404', candidate(film('tmdb:1')))).toThrow(RepoError);
    expect(() => repo.clearFilmOverrides('tmdb:404')).toThrow(RepoError);
  });

  it('ignore des corrections illisibles', () => {
    const db = openDb(':memory:');
    const repo = createRepo(db);
    repo.upsertFilm(film('tmdb:1'));
    db.prepare("UPDATE films SET overrides = '{pas du json' WHERE id = 'tmdb:1'").run();
    expect(repo.getFilm('tmdb:1')).toEqual(shown(film('tmdb:1')));
  });
});
