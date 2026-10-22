import { useEffect, useRef } from 'react';
import type { EffectiveTrailer } from '../../shared/trailer';
import { api } from '../api';

interface YTPlayer {
  mute(): void;
  playVideo(): void;
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
}

export function TrailerView({ trailer, preview }: Props) {
  return trailer.kind === 'youtube' ? (
    <YouTubeTrailer videoId={trailer.key} preview={preview} />
  ) : (
    <LocalTrailer url={trailer.url} preview={preview} />
  );
}

function LocalTrailer({ url, preview }: { url: string; preview: boolean }) {
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
    if (!preview) void video.current?.play?.()?.catch(() => {});
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer.current);
    };
  }, [url, preview]);

  return (
    <div className="trailer">
      <video ref={video} src={url} autoPlay muted={preview} playsInline
        onPlaying={() => window.clearTimeout(startTimer.current)}
        onEnded={() => finish.current()}
        onError={() => finish.current()} />
    </div>
  );
}

function YouTubeTrailer({ videoId, preview }: { videoId: string; preview: boolean }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let done = false;
    let player: YTPlayer | null = null;
    let readyTimer: number | undefined;
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
      readyTimer = window.setTimeout(finish, START_TIMEOUT_MS);
      player = new YT.Player(host, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, iv_load_policy: 3, modestbranding: 1 },
        events: {
          onReady: (e) => {
            window.clearTimeout(readyTimer);
            if (preview) e.target.mute();
            e.target.playVideo();
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
      window.clearTimeout(readyTimer);
      player?.destroy();
      if (box) box.innerHTML = '';
    };
  }, [videoId, preview]);

  return <div ref={container} className="trailer" />;
}
