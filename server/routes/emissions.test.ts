import type { InjectOptions } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Emission } from '../../shared/types';
import { LiveHub } from '../live/hub';
import { fakeTmdb, makeApp } from '../test/helpers';

const BASE = '/api/emissions/2026-10-13';
const filmUrl = (id: string) => `${BASE}/films/${encodeURIComponent(id)}`;

async function withFilms(...filmIds: string[]) {
  const tmdb = fakeTmdb();
  const ctx = await makeApp({ tmdb });
  for (const filmId of filmIds) {
    await ctx.app.inject({ method: 'POST', url: `${BASE}/films`, payload: { filmId, period: 'past' } });
  }
  return { ...ctx, tmdb };
}

describe('API émissions', () => {
  afterEach(() => vi.restoreAllMocks());

  it('diffuse après chaque modification', async () => {
    const { app } = await makeApp();
    const spy = vi.spyOn(LiveHub.prototype, 'broadcast');
    const step = async (req: InjectOptions) => {
      spy.mockClear();
      const res = await app.inject(req);
      expect(res.statusCode).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);
    };
    await step({ method: 'POST', url: `${BASE}/films`, payload: { filmId: 'tmdb:1001', period: 'past' } });
    await step({ method: 'POST', url: `${BASE}/films`, payload: { filmId: 'tmdb:2001', period: 'next' } });
    await step({ method: 'PATCH', url: filmUrl('tmdb:1001'), payload: { notes: 'x' } });
    await step({ method: 'PUT', url: `${BASE}/order`, payload: { filmIds: ['tmdb:2001', 'tmdb:1001'] } });
    await step({ method: 'DELETE', url: filmUrl('tmdb:2001') });
  });

  it('crée l’émission à la première lecture', async () => {
    const { app } = await makeApp();
    const body = (await app.inject(BASE)).json() as Emission;
    expect(body).toMatchObject({ airDate: '2026-10-13', films: [] });
    expect(typeof body.id).toBe('number');
  });

  it('ajoute un film en récupérant sa fiche une seule fois, même en double', async () => {
    const { app, tmdb } = await withFilms('tmdb:1001');
    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/films`,
      payload: { filmId: 'tmdb:1001', period: 'past' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Emission;
    expect(body.films).toHaveLength(1);
    expect(body.films[0]).toMatchObject({ period: 'past', trailerKey: 'frTrailer01' });
    expect(body.films[0]!.film.directors).toEqual(['Réalisatrice X']);
    expect(tmdb.details).toHaveBeenCalledTimes(1);
  });

  it('ordonne, annote et retire', async () => {
    const { app } = await withFilms('tmdb:1001', 'tmdb:2001');
    let res = await app.inject({ method: 'PUT', url: `${BASE}/order`, payload: { filmIds: ['tmdb:2001', 'tmdb:1001'] } });
    expect((res.json() as Emission).films.map((f) => f.film.id)).toEqual(['tmdb:2001', 'tmdb:1001']);

    res = await app.inject({ method: 'PATCH', url: filmUrl('tmdb:1001'), payload: { notes: 'Très beau', score: 8 } });
    expect((res.json() as Emission).films[1]).toMatchObject({ notes: 'Très beau', score: 8 });

    res = await app.inject({ method: 'DELETE', url: filmUrl('tmdb:2001') });
    const after = res.json() as Emission;
    expect(after.films.map((f) => [f.film.id, f.position])).toEqual([['tmdb:1001', 0]]);
  });

  it('refuse une note hors de 0 à 10', async () => {
    const { app } = await withFilms('tmdb:1001');
    const res = await app.inject({ method: 'PATCH', url: filmUrl('tmdb:1001'), payload: { score: 12 } });
    expect(res.statusCode).toBe(400);
  });

  it('refuse un ordre incomplet', async () => {
    const { app } = await withFilms('tmdb:1001', 'tmdb:2001');
    const res = await app.inject({ method: 'PUT', url: `${BASE}/order`, payload: { filmIds: ['tmdb:1001'] } });
    expect(res.statusCode).toBe(400);
  });

  it('refuse un film inconnu ou une période invalide', async () => {
    const { app } = await makeApp();
    const unknown = await app.inject({
      method: 'POST',
      url: `${BASE}/films`,
      payload: { filmId: 'manual:nope', period: 'past' },
    });
    expect(unknown.statusCode).toBe(404);
    const badPeriod = await app.inject({
      method: 'POST',
      url: `${BASE}/films`,
      payload: { filmId: 'tmdb:1001', period: 'hier' },
    });
    expect(badPeriod.statusCode).toBe(400);
  });

  it('refuse une date d’émission invalide', async () => {
    const { app } = await makeApp();
    const res = await app.inject('/api/emissions/hier');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'invalid_date' });
  });
});
