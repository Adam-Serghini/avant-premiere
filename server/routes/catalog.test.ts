import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Film, Releases } from '../../shared/types';
import { LiveHub } from '../live/hub';
import { fakeOmdb, fakeTmdb, makeApp } from '../test/helpers';
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

  it('crée une fiche complète, puis la modifie', async () => {
    const { app, repo } = await makeApp();
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/films/manual',
        payload: { title: 'NASA', genres: ['Documentaire', ' '], runtimeMin: 92, synopsis: '  Une histoire de la conquête spatiale.  ' },
      })
    ).json() as Film;
    expect(created).toMatchObject({
      genres: ['Documentaire'],
      runtimeMin: 92,
      synopsis: 'Une histoire de la conquête spatiale.',
      customPosterUrl: null,
      localTrailerUrl: null,
    });
    repo.setFilmMedia(created.id, 'poster', '/media/x.jpg');
    const res = await app.inject({
      method: 'PUT',
      url: `/api/films/${encodeURIComponent(created.id)}`,
      payload: { title: 'NASA, l’aventure', directors: ['Réalisatrice Y'] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: created.id,
      title: 'NASA, l’aventure',
      directors: ['Réalisatrice Y'],
      genres: [],
      customPosterUrl: '/media/x.jpg',
    });
  });

  describe('notes OMDb', () => {
    const url = '/api/films/tmdb%3A1001/refresh';
    const expected = { imdb: 7.4, rottenTomatoes: 85, metacritic: 72 };

    it('enregistre les notes quand une fiche TMDB est actualisée', async () => {
      const omdb = fakeOmdb();
      const { app, repo } = await makeApp({ omdb });
      const film = (await app.inject({ method: 'POST', url })).json() as Film;
      expect(omdb.ratings).toHaveBeenCalledWith('tt1234567');
      expect(film.ratings).toEqual(expected);
      expect(repo.getFilm('tmdb:1001')?.ratings).toEqual(expected);
    });

    it('les enregistre aussi quand le film est ajouté à l’émission', async () => {
      const omdb = fakeOmdb();
      const { app, repo } = await makeApp({ omdb });
      const res = await app.inject({
        method: 'POST', url: '/api/emissions/2026-10-13/films', payload: { filmId: 'tmdb:1001', period: 'past' },
      });
      expect(res.statusCode).toBeLessThan(300);
      expect(repo.getFilm('tmdb:1001')?.ratings).toEqual(expected);
    });

    it('réussit quand OMDb échoue et garde les notes précédentes', async () => {
      const omdb = fakeOmdb();
      const { app, repo } = await makeApp({ omdb });
      await app.inject({ method: 'POST', url });
      omdb.ratings.mockRejectedValueOnce(new Error('OMDb ne répond pas.'));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const res = await app.inject({ method: 'POST', url });
      expect(res.statusCode).toBe(200);
      expect((res.json() as Film).ratings).toEqual(expected);
      expect(repo.getFilm('tmdb:1001')?.ratings).toEqual(expected);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('garde les notes quand OMDb n’en connaît aucune', async () => {
      const omdb = fakeOmdb();
      const { app } = await makeApp({ omdb });
      await app.inject({ method: 'POST', url });
      omdb.ratings.mockResolvedValueOnce(null);
      expect(((await app.inject({ method: 'POST', url })).json() as Film).ratings).toEqual(expected);
    });

    it('n’appelle pas OMDb sans identifiant IMDb', async () => {
      const omdb = fakeOmdb();
      const tmdb = fakeTmdb({ details: vi.fn(async (id: number) => ({ id, title: 'Sans IMDb', poster_path: null })) });
      const { app } = await makeApp({ tmdb, omdb });
      const film = (await app.inject({ method: 'POST', url })).json() as Film;
      expect(omdb.ratings).not.toHaveBeenCalled();
      expect(film.ratings).toBeNull();
    });

    it('fonctionne sans client OMDb : pas de notes, pas d’erreur', async () => {
      const { app } = await makeApp();
      const res = await app.inject({ method: 'POST', url });
      expect(res.statusCode).toBe(200);
      expect((res.json() as Film).ratings).toBeNull();
    });
  });

  describe('fiche TMDB corrigée', () => {
    const url = '/api/films/tmdb%3A1001';
    async function setup() {
      const ctx = await makeApp();
      const base = (await ctx.app.inject({ method: 'POST', url: `${url}/refresh` })).json() as Film;
      const payload = {
        title: base.title, releaseDateFr: base.releaseDateFr ?? undefined, directors: base.directors, cast: base.cast,
        genres: base.genres, runtimeMin: base.runtimeMin ?? undefined, synopsis: base.synopsis ?? undefined,
      };
      return { ...ctx, base, payload };
    }

    it('modifie le titre et les acteurs, et le dit', async () => {
      const { app, base, payload } = await setup();
      const res = await app.inject({ method: 'PUT', url, payload: { ...payload, title: ' Titre corrigé ', cast: ['Иван', 'Anna'] } });
      expect(res.statusCode).toBe(200);
      const film = res.json() as Film;
      expect(film).toMatchObject({ title: 'Titre corrigé', cast: ['Иван', 'Anna'], source: 'tmdb' });
      expect(film.editedFields).toEqual(['title', 'cast']);
      expect(film.directors).toEqual(base.directors);
    });

    it('survit à l’actualisation', async () => {
      const { app, payload } = await setup();
      await app.inject({ method: 'PUT', url, payload: { ...payload, cast: ['Anna'] } });
      const refreshed = (await app.inject({ method: 'POST', url: `${url}/refresh` })).json() as Film;
      expect(refreshed.cast).toEqual(['Anna']);
      expect(refreshed.editedFields).toEqual(['cast']);
    });

    it('ne retient rien quand les valeurs sont inchangées', async () => {
      const { app, payload } = await setup();
      const res = await app.inject({ method: 'PUT', url, payload });
      expect((res.json() as Film).editedFields).toEqual([]);
    });

    it('ajoute une bande-annonce YouTube', async () => {
      const { app, payload } = await setup();
      const film = (await app.inject({ method: 'PUT', url, payload: { ...payload, trailerUrl: 'https://youtu.be/dQw4w9WgXcQ' } })).json() as Film;
      expect(film.trailers.at(-1)).toEqual({ key: 'dQw4w9WgXcQ', name: 'Bande-annonce ajoutée', lang: 'fr', type: 'Trailer' });
      expect(film.editedFields).toEqual(['extraTrailer']);
    });

    it('valide les champs comme pour une fiche manuelle', async () => {
      const { app, payload } = await setup();
      const res = await app.inject({ method: 'PUT', url, payload: { ...payload, trailerUrl: 'https://vimeo.com/1' } });
      expect(res.json()).toMatchObject({ error: 'invalid_trailer' });
    });

    it('ignore le lien d’affiche', async () => {
      const { app, base, payload } = await setup();
      const film = (await app.inject({ method: 'PUT', url, payload: { ...payload, posterUrl: 'https://x.test/a.jpg' } })).json() as Film;
      expect(film.posterUrl).toBe(base.posterUrl);
    });

    it('revient aux infos TMDB et diffuse', async () => {
      const { app, base, payload } = await setup();
      await app.inject({ method: 'PUT', url, payload: { ...payload, title: 'Autre' } });
      const spy = vi.spyOn(LiveHub.prototype, 'broadcast');
      const res = await app.inject({ method: 'DELETE', url: `${url}/overrides` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(base);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('répond 404 pour une fiche inconnue', async () => {
      const { app } = await makeApp();
      expect((await app.inject({ method: 'DELETE', url: '/api/films/tmdb%3A404/overrides' })).statusCode).toBe(404);
      expect((await app.inject({ method: 'PUT', url: '/api/films/tmdb%3A404', payload: { title: 'X' } })).statusCode).toBe(404);
    });
  });

  it('refuse de modifier une fiche inconnue, et une durée invalide', async () => {
    const { app } = await makeApp();
    expect((await app.inject({ method: 'PUT', url: '/api/films/manual%3Aabsent', payload: { title: 'X' } })).statusCode).toBe(404);
    const post = (payload: object) => app.inject({ method: 'POST', url: '/api/films/manual', payload });
    expect((await post({ title: 'X', runtimeMin: 0 })).statusCode).toBe(400);
    expect((await post({ title: 'X', synopsis: 'x'.repeat(5001) })).statusCode).toBe(400);
  });
});
