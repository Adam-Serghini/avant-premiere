import { useEffect, useRef } from 'react';
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

interface Props {
  videoId: string;
  preview: boolean;
}

export function TrailerView({ videoId, preview }: Props) {
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
    const send = async (): Promise<void> => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (cancelled) return;
        try {
          await api.liveAction({ type: 'trailerEnded' });
          return;
        } catch {
          if (attempt < 3) await new Promise((r) => setTimeout(r, 1000));
        }
      }
      console.warn('Impossible d’envoyer la fin de la bande-annonce après 3 tentatives.');
    };
    const finish = () => {
      if (done || preview) return;
      done = true;
      void send();
    };

    void loadYouTube().then((YT) => {
      if (cancelled) return;
      readyTimer = window.setTimeout(finish, 15_000);
      player = new YT.Player(host, {
        videoId,
        width: '1920',
        height: '1080',
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
