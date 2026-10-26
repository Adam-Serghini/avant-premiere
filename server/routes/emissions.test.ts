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
    await ctx.app.inject({ method: 'POST', url: `${BASE}/films`, payload: { filmId, section: 'seen' } });
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
    await step({ method: 'POST', url: `${BASE}/films`, payload: { filmId: 'tmdb:1001', section: 'seen' } });
    await step({ method: 'POST', url: `${BASE}/films`, payload: { filmId: 'tmdb:2001', section: 'releases' } });
    await step({ method: 'PATCH', url: filmUrl('tmdb:1001'), payload: { opinion: 'x' } });
    await step({ method: 'PUT', url: `${BASE}/order`, payload: { filmIds: ['tmdb:1001', 'tmdb:2001'] } });
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
      payload: { filmId: 'tmdb:1001', section: 'seen' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Emission;
    expect(body.films).toHaveLength(1);
    expect(body.films[0]).toMatchObject({ section: 'seen', trailerKey: 'frTrailer01' });
    expect(body.films[0]!.film.directors).toEqual(['Réalisatrice X']);
    expect(tmdb.details).toHaveBeenCalledTimes(1);
  });

  it('ordonne, annote et retire', async () => {
    const { app } = await withFilms('tmdb:1001', 'tmdb:2001');
    let res = await app.inject({ method: 'PUT', url: `${BASE}/order`, payload: { filmIds: ['tmdb:2001', 'tmdb:1001'] } });
    expect((res.json() as Emission).films.map((f) => f.film.id)).toEqual(['tmdb:2001', 'tmdb:1001']);

    res = await app.inject({ method: 'PATCH', url: filmUrl('tmdb:1001'), payload: { opinion: 'Très beau', score: 8 } });
    expect((res.json() as Emission).films[1]).toMatchObject({ opinion: 'Très beau', score: 8 });

    res = await app.inject({ method: 'DELETE', url: filmUrl('tmdb:2001') });
    const after = res.json() as Emission;
    expect(after.films.map((f) => [f.film.id, f.position])).toEqual([['tmdb:1001', 0]]);
  });

  it('refuse une section de notes trop longue', async () => {
    const { app } = await withFilms('tmdb:1001');
    const res = await app.inject({
      method: 'PATCH',
      url: filmUrl('tmdb:1001'),
      payload: { anecdotes: 'x'.repeat(20001) },
    });
    expect(res.statusCode).toBe(400);
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

  it('refuse un film inconnu ou une partie invalide', async () => {
    const { app } = await makeApp();
    const unknown = await app.inject({
      method: 'POST',
      url: `${BASE}/films`,
      payload: { filmId: 'manual:nope', section: 'seen' },
    });
    expect(unknown.statusCode).toBe(404);
    const badSection = await app.inject({
      method: 'POST',
      url: `${BASE}/films`,
      payload: { filmId: 'tmdb:1001', section: 'past' },
    });
    expect(badSection.statusCode).toBe(400);
  });

  it('range un film dans la partie choisie et le déplace par PATCH', async () => {
    const { app } = await withFilms('tmdb:1001');
    const added = await app.inject({ method: 'POST', url: `${BASE}/films`, payload: { filmId: 'tmdb:2001', section: 'docu' } });
    expect(added.statusCode).toBe(200);
    expect((added.json() as Emission).films.map((f) => [f.film.id, f.section])).toEqual([
      ['tmdb:1001', 'seen'],
      ['tmdb:2001', 'docu'],
    ]);
    const moved = await app.inject({ method: 'PATCH', url: filmUrl('tmdb:2001'), payload: { section: 'seen' } });
    expect(moved.statusCode).toBe(200);
    expect((moved.json() as Emission).films.map((f) => [f.film.id, f.section, f.position])).toEqual([
      ['tmdb:1001', 'seen', 0],
      ['tmdb:2001', 'seen', 1],
    ]);
    const bad = await app.inject({ method: 'PATCH', url: filmUrl('tmdb:2001'), payload: { section: 'next' } });
    expect(bad.statusCode).toBe(400);
  });

  it('refuse une date d’émission invalide', async () => {
    const { app } = await makeApp();
    const res = await app.inject('/api/emissions/hier');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'invalid_date' });
  });
});
