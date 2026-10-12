import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Film, Releases } from '../../shared/types';
import { LiveHub } from '../live/hub';
import { fakeTmdb, makeApp } from '../test/helpers';
import { TmdbError } from '../tmdb/client';

describe('API catalogue', () => {
  afterEach(() => vi.restoreAllMocks());

  it('valide la date avant de réclamer la clé TMDB', async () => {
    const { app } = await makeApp({ tmdb: null });
    const res = await app.inject('/api/releases?date=hier');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'invalid_date' });
  });

  it('diffuse après l’actualisation d’une fiche', async () => {
    const spy = vi.spyOn(LiveHub.prototype, 'broadcast');
    const { app } = await makeApp();
    await app.inject({ method: 'POST', url: `/api/films/${encodeURIComponent('tmdb:1001')}/refresh` });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('donne le prochain mardi', async () => {
    const { app } = await makeApp();
    expect((await app.inject('/api/today')).json()).toEqual({ airDate: '2026-10-13' });
  });

  it('indique l’état de la clé TMDB', async () => {
    expect((await (await makeApp()).app.inject('/api/health')).json()).toEqual({ tmdb: 'ok' });
    expect((await (await makeApp({ tmdb: null })).app.inject('/api/health')).json()).toEqual({ tmdb: 'missing' });
  });

  it('liste les sorties des deux périodes', async () => {
    const { app } = await makeApp();
    const res = await app.inject('/api/releases?date=2026-10-13');
    expect(res.statusCode).toBe(200);
    const body = res.json() as Releases;
    expect(body.past).toMatchObject({ from: '2026-10-07', to: '2026-10-13' });
    expect(body.past.films[0]).toMatchObject({ id: 'tmdb:1001', title: 'Film passé' });
    expect(body.next.films[0]!.id).toBe('tmdb:2001');
  });

  it('refuse une date absente ou invalide', async () => {
    const { app } = await makeApp();
    for (const url of ['/api/releases?date=2026-02-30', '/api/releases']) {
      const res = await app.inject(url);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: 'invalid_date' });
    }
  });

  it('explique qu’il manque la clé TMDB', async () => {
    const { app } = await makeApp({ tmdb: null });
    const res = await app.inject('/api/releases?date=2026-10-13');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ error: 'tmdb_missing_key' });
    expect(res.json().message).toContain('TMDB_API_KEY');
  });

  it('signale un TMDB injoignable ou une clé refusée', async () => {
    const down = fakeTmdb({
      discover: async () => {
        throw new TmdbError('unavailable', 'x');
      },
    });
    const res = await (await makeApp({ tmdb: down })).app.inject('/api/releases?date=2026-10-13');
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: 'tmdb_unavailable', message: 'TMDB ne répond pas, réessaie.' });

    const refused = fakeTmdb({
      discover: async () => {
        throw new TmdbError('auth', 'x');
      },
    });
    const res2 = await (await makeApp({ tmdb: refused })).app.inject('/api/releases?date=2026-10-13');
    expect(res2.statusCode).toBe(502);
    expect(res2.json()).toMatchObject({ error: 'tmdb_auth' });
  });

  it('cherche par titre', async () => {
    const { app } = await makeApp();
    expect((await app.inject('/api/search?q=ressortie')).json()).toEqual([
      { id: 'tmdb:3001', title: 'Ressortie', posterUrl: 'https://image.tmdb.org/t/p/w342/r.jpg', year: '1967' },
    ]);
  });

  it('ignore les recherches trop courtes', async () => {
    const tmdb = fakeTmdb();
    const { app } = await makeApp({ tmdb });
    expect((await app.inject('/api/search?q=a')).json()).toEqual([]);
    expect(tmdb.search).not.toHaveBeenCalled();
  });

  it('crée un film saisi à la main', async () => {
    const { app, repo } = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/films/manual',
      payload: {
        title: '  Avant-première  ',
        releaseDateFr: '2026-10-14',
        directors: ['Réalisatrice X', ' '],
        trailerUrl: 'https://youtu.be/dQw4w9WgXcQ',
      },
    });
    expect(res.statusCode).toBe(201);
    const film = res.json() as Film;
    expect(film.id).toMatch(/^manual:/);
    expect(film).toMatchObject({ source: 'manual', title: 'Avant-première', directors: ['Réalisatrice X'] });
    expect(film.trailers).toEqual([{ key: 'dQw4w9WgXcQ', name: 'Bande-annonce', lang: 'fr', type: 'Trailer' }]);
    expect(repo.getFilm(film.id)?.title).toBe('Avant-première');
  });

  it('refuse un film manuel incomplet ou mal renseigné', async () => {
    const { app } = await makeApp();
    const post = (payload: object) => app.inject({ method: 'POST', url: '/api/films/manual', payload });
    expect((await post({ title: '   ' })).statusCode).toBe(400);
    expect((await post({ title: 'X', trailerUrl: 'https://vimeo.com/1' })).json()).toMatchObject({
      error: 'invalid_trailer',
    });
    expect((await post({ title: 'X', posterUrl: 'affiche.jpg' })).json()).toMatchObject({ error: 'invalid_poster' });
    expect((await post({ title: 'X', releaseDateFr: '14/10/2026' })).json()).toMatchObject({ error: 'invalid_date' });
  });

  it('actualise une fiche TMDB', async () => {
    const tmdb = fakeTmdb();
    const { app, repo } = await makeApp({ tmdb });
    const res = await app.inject({ method: 'POST', url: `/api/films/${encodeURIComponent('tmdb:1001')}/refresh` });
    expect(res.statusCode).toBe(200);
    expect(tmdb.details).toHaveBeenCalledWith(1001);
    expect(repo.getFilm('tmdb:1001')?.title).toBe('La Nuit du projectionniste');
  });

  it('refuse d’actualiser un film manuel', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/api/films/manual%3Aabc/refresh' });
    expect(res.statusCode).toBe(400);
  });
});
