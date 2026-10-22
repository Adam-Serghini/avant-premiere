import { describe, expect, it } from 'vitest';
import type { Film } from '../../shared/types';
import { openDb } from '../db';
import { createRepo } from '../repo';
import { createLiveService } from './service';

const DATE = '2026-10-13';

function film(id: string, withTrailer: boolean): Film {
  return {
    id,
    source: 'tmdb',
    title: `Film ${id}`,
    originalTitle: null,
    releaseDateFr: null,
    posterUrl: null,
    customPosterUrl: null,
    localTrailerUrl: null,
    directors: [],
    cast: [],
    genres: [],
    runtimeMin: null,
    synopsis: null,
    trailers: withTrailer ? [{ key: `ba-${id}`, name: 'BA', lang: 'fr', type: 'Trailer' }] : [],
    fetchedAt: null,
  };
}

function setup() {
  const repo = createRepo(openDb(':memory:'));
  repo.upsertFilm(film('tmdb:1', true));
  repo.upsertFilm(film('tmdb:2', false));
  repo.addFilm(DATE, 'tmdb:1', 'past');
  repo.addFilm(DATE, 'tmdb:2', 'next');
  return { repo, live: createLiveService(repo) };
}

describe('service du live', () => {
  it('donne un instantané vide avant le démarrage', () => {
    const { live } = setup();
    expect(live.snapshot(false)).toEqual({
      state: { emissionId: null, airDate: null, position: 0, mode: 'full' },
      total: 0,
      rundown: [],
      current: null,
      overlayConnected: false,
    });
  });

  it('démarre l’émission et suit le film à l’antenne', () => {
    const { live } = setup();
    live.apply({ type: 'start', airDate: DATE });
    let snap = live.snapshot(true);
    expect(snap.total).toBe(2);
    expect(snap.rundown).toEqual([
      { filmId: 'tmdb:1', title: 'Film tmdb:1' },
      { filmId: 'tmdb:2', title: 'Film tmdb:2' },
    ]);
    expect(snap.current?.film.id).toBe('tmdb:1');
    expect(snap.overlayConnected).toBe(true);
    live.apply({ type: 'next' });
    snap = live.snapshot(false);
    expect(snap.state.position).toBe(1);
    expect(snap.current?.film.id).toBe('tmdb:2');
  });

  it('refuse la bande-annonce d’un film qui n’en a pas', () => {
    const { live } = setup();
    live.apply({ type: 'start', airDate: DATE });
    live.apply({ type: 'setMode', mode: 'trailer' });
    expect(live.snapshot(false).state.mode).toBe('trailer');
    live.apply({ type: 'next' });
    live.apply({ type: 'setMode', mode: 'trailer' });
    expect(live.snapshot(false).state.mode).toBe('full');
  });

  it('recadre le film à l’antenne quand on le retire du conducteur', () => {
    const { repo, live } = setup();
    live.apply({ type: 'start', airDate: DATE });
    live.apply({ type: 'next' });
    repo.removeFilm(DATE, 'tmdb:2');
    const snap = live.snapshot(false);
    expect(snap.state.position).toBe(0);
    expect(snap.current?.film.id).toBe('tmdb:1');
  });

  it('conserve l’état entre deux instances du service', () => {
    const { repo, live } = setup();
    live.apply({ type: 'start', airDate: DATE });
    live.apply({ type: 'next' });
    expect(createLiveService(repo).snapshot(false).state.position).toBe(1);
  });

  it('repasse en fiche quand le film retiré laisse un film sans bande-annonce', () => {
    const { repo, live } = setup();
    live.apply({ type: 'start', airDate: DATE });
    live.apply({ type: 'setMode', mode: 'trailer' });
    repo.removeFilm(DATE, 'tmdb:1');
    const snap = live.snapshot(false);
    expect(snap.current?.film.id).toBe('tmdb:2');
    expect(snap.state.mode).toBe('full');
  });
});
