// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerState } from '../../shared/types';
import { api } from '../api';
import { TrailerView } from './TrailerView';

vi.mock('../api', () => ({ api: { liveAction: vi.fn() } }));

const POSTER = { url: '/media/affiche.jpg', title: 'Le Samouraï' };
const LOCAL = { kind: 'local', url: '/media/v.mp4' } as const;

function playerState(over: Partial<PlayerState> = {}): PlayerState {
  return { paused: false, volume: 100, seek: null, ...over };
}

function setTimes(video: HTMLVideoElement, t: number, d: number) {
  Object.defineProperty(video, 'currentTime', { value: t, writable: true, configurable: true });
  Object.defineProperty(video, 'duration', { value: d, configurable: true });
}

describe('bande-annonce locale', () => {
  beforeEach(() => {
    vi.mocked(api.liveAction).mockResolvedValue({} as never);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('joue le fichier avec le son et signale la fin une seule fois', async () => {
    const { container } = render(<TrailerView trailer={LOCAL} preview={false} player={playerState()} poster={POSTER} />);
    const video = container.querySelector('video')!;
    expect(video.getAttribute('src')).toBe('/media/v.mp4');
    expect(video.muted).toBe(false);
    fireEvent.ended(video);
    fireEvent.ended(video);
    await vi.waitFor(() => expect(api.liveAction).toHaveBeenCalledTimes(1));
    expect(api.liveAction).toHaveBeenCalledWith({ type: 'trailerEnded' });
  });

  it('signale la fin si la lecture échoue ou ne démarre pas en 15 s', async () => {
    vi.useFakeTimers();
    render(<TrailerView trailer={LOCAL} preview={false} player={playerState()} poster={POSTER} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(api.liveAction).toHaveBeenCalledWith({ type: 'trailerEnded' });
  });

  it('reste muette et silencieuse en aperçu', () => {
    const { container } = render(<TrailerView trailer={LOCAL} preview player={playerState()} poster={POSTER} />);
    const video = container.querySelector('video')!;
    expect(video.muted).toBe(true);
    fireEvent.ended(video);
    expect(api.liveAction).not.toHaveBeenCalled();
  });
});

describe('bande-annonce locale pilotée par la Régie', () => {
  let play: ReturnType<typeof vi.spyOn>;
  let pause: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.mocked(api.liveAction).mockResolvedValue({} as never);
    play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const view = (player: PlayerState, preview = false) => (
    <TrailerView trailer={LOCAL} preview={preview} player={player} poster={POSTER} />
  );

  it('met en pause puis relance la lecture', () => {
    const { rerender } = render(view(playerState()));
    play.mockClear();
    rerender(view(playerState({ paused: true })));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(play).not.toHaveBeenCalled();
    rerender(view(playerState({ paused: false })));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('applique le volume, et l’aperçu reste muet', () => {
    const { container, rerender } = render(view(playerState({ volume: 60 })));
    expect(container.querySelector('video')!.volume).toBeCloseTo(0.6);
    rerender(view(playerState({ volume: 30 })));
    expect(container.querySelector('video')!.volume).toBeCloseTo(0.3);
    cleanup();
    const preview = render(view(playerState({ volume: 60 }), true));
    expect(preview.container.querySelector('video')!.muted).toBe(true);
  });

  it('avance de 5 s sans dépasser 1 s avant la fin', () => {
    const { container, rerender } = render(view(playerState()));
    const video = container.querySelector('video')!;
    setTimes(video, 20, 30);
    rerender(view(playerState({ seek: { id: 1, kind: 'forward' } })));
    expect(video.currentTime).toBe(25);
    setTimes(video, 28, 30);
    rerender(view(playerState({ seek: { id: 2, kind: 'forward' } })));
    expect(video.currentTime).toBe(29);
    setTimes(video, 29.5, 30);
    rerender(view(playerState({ seek: { id: 3, kind: 'forward' } })));
    expect(video.currentTime).toBe(29.5);
    expect(api.liveAction).not.toHaveBeenCalled();
  });

  it('recule de 5 s sans passer sous 0', () => {
    const { container, rerender } = render(view(playerState()));
    const video = container.querySelector('video')!;
    setTimes(video, 3, 30);
    rerender(view(playerState({ seek: { id: 1, kind: 'back' } })));
    expect(video.currentTime).toBe(0);
  });

  it('revient au début sans relancer une lecture en pause', () => {
    const { container, rerender } = render(view(playerState({ paused: true })));
    const video = container.querySelector('video')!;
    setTimes(video, 12, 30);
    play.mockClear();
    rerender(view(playerState({ paused: true, seek: { id: 1, kind: 'restart' } })));
    expect(video.currentTime).toBe(0);
    expect(play).not.toHaveBeenCalled();
  });

  it('ignore le saut déjà présent au montage et un rendu qui le répète', () => {
    const setTime = vi.spyOn(HTMLMediaElement.prototype, 'currentTime', 'set');
    const seek = { id: 5, kind: 'restart' } as const;
    const { container, rerender } = render(view(playerState({ seek })));
    expect(setTime).not.toHaveBeenCalled();
    const video = container.querySelector('video')!;
    setTimes(video, 12, 30);
    rerender(view(playerState({ seek: { ...seek }, volume: 90 })));
    expect(video.currentTime).toBe(12);
  });

  it('une pause avant le démarrage annule le délai de garde', async () => {
    vi.useFakeTimers();
    const { rerender } = render(view(playerState()));
    rerender(view(playerState({ paused: true })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(api.liveAction).not.toHaveBeenCalled();
  });

  it('n’affiche pas de couverture de pause pour une vidéo locale', () => {
    const { container } = render(view(playerState({ paused: true })));
    expect(container.querySelector('.trailer-pause')).toBeNull();
  });
});

describe('bande-annonce YouTube pilotée par la Régie', () => {
  const players: FakePlayer[] = [];
  class FakePlayer {
    pauseVideo = vi.fn();
    playVideo = vi.fn();
    seekTo = vi.fn();
    getCurrentTime = vi.fn(() => 20);
    getDuration = vi.fn(() => 30);
    setVolume = vi.fn();
    mute = vi.fn();
    destroy = vi.fn();
    constructor(_el: HTMLElement, opts: { events: { onReady(e: { target: FakePlayer }): void } }) {
      players.push(this);
      queueMicrotask(() => opts.events.onReady({ target: this }));
    }
  }

  beforeEach(() => {
    players.length = 0;
    window.YT = { Player: FakePlayer, PlayerState: { ENDED: 0 } } as never;
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    delete window.YT;
  });

  const view = (player: PlayerState, preview = false) => (
    <TrailerView trailer={{ kind: 'youtube', key: 'abc' }} preview={preview} player={player} poster={POSTER} />
  );

  it('met en pause sous l’affiche et « Pause », puis reprend', async () => {
    const { container, rerender } = render(view(playerState({ volume: 70 })));
    await vi.waitFor(() => expect(players[0]?.playVideo).toHaveBeenCalled());
    const yt = players[0];
    expect(yt.setVolume).toHaveBeenCalledWith(70);
    rerender(view(playerState({ volume: 70, paused: true })));
    expect(yt.pauseVideo).toHaveBeenCalledTimes(1);
    const cover = container.querySelector('.trailer-pause')!;
    expect(cover).not.toBeNull();
    expect(cover.querySelector('img')!.getAttribute('src')).toBe('/media/affiche.jpg');
    expect(cover.textContent).toContain('Pause');
    yt.playVideo.mockClear();
    rerender(view(playerState({ volume: 70, paused: false })));
    expect(yt.playVideo).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.trailer-pause')).toBeNull();
  });

  it('saute dans la vidéo et suit le volume', async () => {
    const { rerender } = render(view(playerState()));
    await vi.waitFor(() => expect(players[0]?.playVideo).toHaveBeenCalled());
    const yt = players[0];
    rerender(view(playerState({ seek: { id: 1, kind: 'forward' } })));
    expect(yt.seekTo).toHaveBeenCalledWith(25, true);
    rerender(view(playerState({ seek: { id: 1, kind: 'forward' }, volume: 40 })));
    expect(yt.seekTo).toHaveBeenCalledTimes(1);
    expect(yt.setVolume).toHaveBeenLastCalledWith(40);
  });

  it('en aperçu, reste muet et montre la même couverture de pause', async () => {
    const { container } = render(view(playerState({ paused: true, volume: 60 }), true));
    await vi.waitFor(() => expect(players[0]?.mute).toHaveBeenCalled());
    const yt = players[0];
    expect(yt.setVolume).not.toHaveBeenCalled();
    expect(yt.playVideo).not.toHaveBeenCalled();
    expect(yt.pauseVideo).toHaveBeenCalled();
    expect(container.querySelector('.trailer-pause')).not.toBeNull();
  });
});
