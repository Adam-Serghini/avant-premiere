import { describe, expect, it } from 'vitest';
import type { PlayerCommand } from '../../shared/shortcuts';
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
    editedFields: [],
    imdbId: null,
    ratings: null,
  };
}

function setup() {
  const repo = createRepo(openDb(':memory:'));
  repo.upsertFilm(film('tmdb:1', true));
  repo.upsertFilm(film('tmdb:2', false));
  repo.addFilm(DATE, 'tmdb:1', 'seen');
  repo.addFilm(DATE, 'tmdb:2', 'releases');
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
      player: { paused: false, volume: 100, seek: null },
    });
  });

  it('démarre l’émission et suit le film à l’antenne', () => {
    const { live } = setup();
    live.apply({ type: 'start', airDate: DATE });
    let snap = live.snapshot(true);
    expect(snap.total).toBe(2);
    expect(snap.rundown).toEqual([
      { filmId: 'tmdb:1', title: 'Film tmdb:1', section: 'seen' },
      { filmId: 'tmdb:2', title: 'Film tmdb:2', section: 'releases' },
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

  it('accepte une vidéo locale et quitte la bande-annonce quand on la retire', () => {
    const { repo, live } = setup();
    repo.setFilmMedia('tmdb:2', 'trailer', '/media/v.mp4');
    live.apply({ type: 'start', airDate: DATE });
    live.apply({ type: 'next' });
    live.apply({ type: 'setMode', mode: 'trailer' });
    expect(live.snapshot(false).state.mode).toBe('trailer');
    repo.setFilmMedia('tmdb:2', 'trailer', null);
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
  describe('lecteur', () => {
    const cmd = (live: ReturnType<typeof setup>['live'], command: PlayerCommand) => live.apply({ type: 'player', command });

    it('ignore pause et sauts hors bande-annonce', () => {
      const { live } = setup();
      live.apply({ type: 'start', airDate: DATE });
      for (const c of ['togglePause', 'back', 'forward', 'restart'] as const) cmd(live, c);
      expect(live.snapshot(false).player).toEqual({ paused: false, volume: 100, seek: null });
    });

    it('règle le volume par pas de 10, borné entre 0 et 100', () => {
      const { live } = setup();
      cmd(live, 'volumeDown');
      expect(live.snapshot(false).player.volume).toBe(90);
      for (let i = 0; i < 10; i++) cmd(live, 'volumeDown');
      expect(live.snapshot(false).player.volume).toBe(0);
      for (let i = 0; i < 12; i++) cmd(live, 'volumeUp');
      expect(live.snapshot(false).player.volume).toBe(100);
    });

    it('relit le volume après recréation du service', () => {
      const { repo, live } = setup();
      cmd(live, 'volumeDown');
      expect(createLiveService(repo).snapshot(false).player.volume).toBe(90);
    });

    it('met en pause et saute en mode bande-annonce', () => {
      const { live } = setup();
      live.apply({ type: 'start', airDate: DATE });
      live.apply({ type: 'setMode', mode: 'trailer' });
      cmd(live, 'togglePause');
      expect(live.snapshot(false).player.paused).toBe(true);
      cmd(live, 'togglePause');
      expect(live.snapshot(false).player.paused).toBe(false);
      cmd(live, 'back');
      const first = live.snapshot(false).player.seek;
      expect(first).toMatchObject({ kind: 'back' });
      cmd(live, 'forward');
      const second = live.snapshot(false).player.seek;
      expect(second).toMatchObject({ kind: 'forward' });
      expect(second!.id).toBeGreaterThan(first!.id);
    });

    it('remet pause et saut à zéro à l’entrée, au changement de film et à la fin', () => {
      const { repo, live } = setup();
      repo.setFilmMedia('tmdb:2', 'trailer', '/media/v.mp4');
      live.apply({ type: 'start', airDate: DATE });
      live.apply({ type: 'setMode', mode: 'trailer' });
      const dirty = () => {
        cmd(live, 'togglePause');
        cmd(live, 'forward');
        expect(live.snapshot(false).player).toMatchObject({ paused: true, seek: { kind: 'forward' } });
      };
      const clean = { paused: false, seek: null };
      dirty();
      live.apply({ type: 'next' });
      expect(live.snapshot(false).player).toMatchObject(clean);
      live.apply({ type: 'setMode', mode: 'trailer' });
      dirty();
      live.apply({ type: 'trailerEnded' });
      expect(live.snapshot(false).player).toMatchObject(clean);
      live.apply({ type: 'setMode', mode: 'trailer' });
      expect(live.snapshot(false).player).toMatchObject(clean);
    });
  });
});
