import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import type { LiveSnapshot } from '../../shared/types';
import { makeApp } from '../test/helpers';

const DATE = '2026-10-13';

describe('mode Carte supprimé', () => {
  it('refuse le mode Carte, qui n’existe plus', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/api/live', payload: { type: 'setMode', mode: 'card' } });
    expect(res.statusCode).toBe(400);
  });
});

async function withTwoFilms() {
  const ctx = await makeApp();
  for (const filmId of ['tmdb:1001', 'tmdb:2001']) {
    await ctx.app.inject({ method: 'POST', url: `/api/emissions/${DATE}/films`, payload: { filmId, section: 'seen' } });
  }
  const act = async (payload: object) =>
    (await ctx.app.inject({ method: 'POST', url: '/api/live', payload })).json() as LiveSnapshot;
  return { ...ctx, act };
}

describe('API du live', () => {
  it('démarre l’émission et avance', async () => {
    const { act } = await withTwoFilms();
    let snap = await act({ type: 'start', airDate: DATE });
    expect(snap.state).toMatchObject({ airDate: DATE, position: 0, mode: 'full' });
    expect(snap.total).toBe(2);
    expect(snap.rundown.map((r) => r.filmId)).toEqual(['tmdb:1001', 'tmdb:2001']);
    snap = await act({ type: 'next' });
    expect(snap.current?.film.id).toBe('tmdb:2001');
    snap = await act({ type: 'next' });
    expect(snap.state.position).toBe(1);
  });

  it('passe en bande-annonce puis revient sur la carte à la fin', async () => {
    const { act } = await withTwoFilms();
    await act({ type: 'start', airDate: DATE });
    expect((await act({ type: 'setMode', mode: 'trailer' })).state.mode).toBe('trailer');
    expect((await act({ type: 'trailerEnded' })).state.mode).toBe('full');
  });

  it('refuse une action invalide', async () => {
    const { app } = await withTwoFilms();
    for (const payload of [{ type: 'saut' }, { type: 'setMode', mode: 'disco' }, { type: 'start', airDate: 'hier' }]) {
      const res = await app.inject({ method: 'POST', url: '/api/live', payload });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: 'invalid_action' });
    }
  });

  it('accepte une commande du lecteur et refuse les autres', async () => {
    const { app } = await withTwoFilms();
    const ok = await app.inject({ method: 'POST', url: '/api/live', payload: { type: 'player', command: 'volumeUp' } });
    expect(ok.statusCode).toBe(200);
    const bad = await app.inject({ method: 'POST', url: '/api/live', payload: { type: 'player', command: 'boom' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ message: 'Action de régie invalide.' });
  });

  it('recadre le film à l’antenne si on le retire du conducteur', async () => {
    const { app, act } = await withTwoFilms();
    await act({ type: 'start', airDate: DATE });
    await act({ type: 'next' });
    await app.inject({ method: 'DELETE', url: `/api/emissions/${DATE}/films/${encodeURIComponent('tmdb:2001')}` });
    const snap = (await app.inject('/api/live')).json() as LiveSnapshot;
    expect(snap.state.position).toBe(0);
    expect(snap.current?.film.id).toBe('tmdb:1001');
  });

  it('diffuse l’état en SSE et signale la connexion d’OBS', async () => {
    const { app } = await withTwoFilms();
    await app.listen({ port: 0, host: '127.0.0.1' });
    try {
      const { port } = app.server.address() as AddressInfo;
      const abort = new AbortController();
      const res = await fetch(`http://127.0.0.1:${port}/api/live/stream?client=overlay`, { signal: abort.signal });
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      const reader = res.body!.getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      expect(text.startsWith('data: ')).toBe(true);
      const snap = JSON.parse(text.slice('data: '.length).split('\n\n')[0]!) as LiveSnapshot;
      expect(snap.overlayConnected).toBe(true);
      expect((await app.inject('/api/live')).json()).toMatchObject({ overlayConnected: true });

      abort.abort();
      await vi.waitFor(async () => {
        expect((await app.inject('/api/live')).json()).toMatchObject({ overlayConnected: false });
      });
    } finally {
      await app.close();
    }
  });
});
