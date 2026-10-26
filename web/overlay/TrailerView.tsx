import { useEffect, useRef } from 'react';
import type { EffectiveTrailer } from '../../shared/trailer';
import type { PlayerState } from '../../shared/types';
import { api } from '../api';
import { Poster } from '../components/Poster';

interface YTPlayer {
  mute(): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, number>;
      events: {
        onReady(e: { target: YTPlayer }): void;
        onStateChange(e: { data: number }): void;
        onError(): void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytReady: Promise<YTNamespace> | null = null;

function loadYouTube(): Promise<YTNamespace> {
  if (!ytReady) {
    ytReady = new Promise<YTNamespace>((resolve, reject) => {
      if (window.YT?.Player) {
        resolve(window.YT);
        return;
      }
      const previous = window.onYouTubeIframeAPIReady;
      const script = document.createElement('script');
      const fail = () => {
        window.clearTimeout(timer);
        script.remove();
        ytReady = null;
        reject(new Error('API YouTube indisponible'));
      };
      const timer = window.setTimeout(fail, 10_000);
      window.onYouTubeIframeAPIReady = () => {
        window.clearTimeout(timer);
        previous?.();
        resolve(window.YT!);
      };
      script.onerror = fail;
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    });
  }
  return ytReady;
}

const START_TIMEOUT_MS = 15_000;
const SEEK_STEP_S = 5;

type SeekKind = NonNullable<PlayerState['seek']>['kind'];

/** Position visée par un saut, ou null s'il ne doit rien faire. */
function seekTarget(kind: SeekKind, t: number, d: number): number | null {
  if (kind === 'restart') return 0;
  if (kind === 'back') return Math.max(0, t - SEEK_STEP_S);
  // +5 s s'arrête 1 s avant la fin : un saut ne termine jamais la bande-annonce.
  const target = Math.min(t + SEEK_STEP_S, d - 1);
  return target > t ? target : null;
}

/** Appelle `apply` pour chaque nouveau saut ; celui présent au montage est déjà passé. */
function useSeek(seek: PlayerState['seek'], apply: (kind: SeekKind) => void) {
  const lastId = useRef(seek?.id ?? null);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    if (!seek || seek.id === lastId.current) return;
    lastId.current = seek.id;
    applyRef.current(seek.kind);
  }, [seek?.id]);
}

/** Prévient le serveur que la bande-annonce est finie (3 essais), sauf si l'affichage a changé entre-temps. */
async function reportEnded(isCancelled: () => boolean): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (isCancelled()) return;
    try {
      await api.liveAction({ type: 'trailerEnded' });
      return;
    } catch {
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  console.warn('Impossible d’envoyer la fin de la bande-annonce après 3 tentatives.');
}

interface Props {
  trailer: NonNullable<EffectiveTrailer>;
  preview: boolean;
  player: PlayerState;
  poster: { url: string | null; title: string };
}

export function TrailerView({ trailer, preview, player, poster }: Props) {
  return trailer.kind === 'youtube' ? (
    <YouTubeTrailer videoId={trailer.key} preview={preview} player={player} poster={poster} />
  ) : (
    <LocalTrailer url={trailer.url} preview={preview} player={player} />
  );
}

function LocalTrailer({ url, preview, player }: { url: string; preview: boolean; player: PlayerState }) {
  const video = useRef<HTMLVideoElement>(null);
  const finish = useRef<() => void>(() => {});
  const startTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let done = false;
    finish.current = () => {
      if (done || preview) return;
      done = true;
      void reportEnded(() => cancelled);
    };
    startTimer.current = window.setTimeout(() => finish.current(), START_TIMEOUT_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer.current);
    };
  }, [url, preview]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (player.paused) {
      // Une pause voulue n'est pas une lecture qui ne démarre pas.
      window.clearTimeout(startTimer.current);
      v.pause();
    } else {
      void v.play?.()?.catch(() => {});
    }
  }, [player.paused]);

  useEffect(() => {
    if (video.current) video.current.volume = player.volume / 100;
  }, [player.volume]);

  useSeek(player.seek, (kind) => {
    const v = video.current;
    if (!v) return;
    const target = seekTarget(kind, v.currentTime, v.duration);
    if (target !== null) v.currentTime = target;
  });

  return (
    <div className="trailer">
      <video ref={video} src={url} autoPlay muted={preview} playsInline
        onPlaying={() => window.clearTimeout(startTimer.current)}
        onEnded={() => finish.current()}
        onError={() => finish.current()} />
    </div>
  );
}

interface YouTubeProps {
  videoId: string;
  preview: boolean;
  player: PlayerState;
  poster: { url: string | null; title: string };
}

function YouTubeTrailer({ videoId, preview, player, poster }: YouTubeProps) {
  const container = useRef<HTMLDivElement>(null);
  const yt = useRef<YTPlayer | null>(null);
  const readyTimer = useRef<number | undefined>(undefined);
  // Dernier état reçu, lu par onReady qui arrive plus tard.
  const latest = useRef(player);
  latest.current = player;

  const applyVolume = (p: YTPlayer) => {
    if (preview) p.mute();
    else p.setVolume(latest.current.volume);
  };

  useEffect(() => {
    let cancelled = false;
    let done = false;
    let instance: YTPlayer | null = null;
    const box = container.current;
    // Le lecteur YouTube remplace l'élément qu'on lui donne : on lui fournit un nœud
    // créé à la main pour que React ne gère jamais ce sous-arbre.
    const host = document.createElement('div');
    box?.appendChild(host);
    const finish = () => {
      if (done || preview) return;
      done = true;
      void reportEnded(() => cancelled);
    };

    void loadYouTube().then((YT) => {
      if (cancelled) return;
      if (!latest.current.paused) readyTimer.current = window.setTimeout(finish, START_TIMEOUT_MS);
      instance = new YT.Player(host, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, iv_load_policy: 3, modestbranding: 1 },
        events: {
          onReady: (e) => {
            if (cancelled) return;
            window.clearTimeout(readyTimer.current);
            yt.current = e.target;
            applyVolume(e.target);
            if (latest.current.paused) e.target.pauseVideo();
            else e.target.playVideo();
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) finish();
          },
          onError: finish,
        },
      });
    }, finish);

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimer.current);
      yt.current = null;
      instance?.destroy();
      if (box) box.innerHTML = '';
    };
  }, [videoId, preview]);

  useEffect(() => {
    if (player.paused) window.clearTimeout(readyTimer.current);
    const p = yt.current;
    if (!p) return;
    if (player.paused) p.pauseVideo();
    else p.playVideo();
  }, [player.paused]);

  useEffect(() => {
    if (yt.current) applyVolume(yt.current);
  }, [player.volume]);

  useSeek(player.seek, (kind) => {
    const p = yt.current;
    if (!p) return;
    const target = seekTarget(kind, p.getCurrentTime(), p.getDuration());
    if (target !== null) p.seekTo(target, true);
  });

  return (
    <div className="trailer">
      <div ref={container} className="trailer-host" />
      {player.paused && (
        <div className="trailer-pause">
          <div className="trailer-pause-poster">
            <Poster url={poster.url} title={poster.title} />
          </div>
          <span className="trailer-pause-label">Pause</span>
        </div>
      )}
    </div>
  );
}
