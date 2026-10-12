import { useEffect, useState } from 'react';
import type { LiveSnapshot } from '../../shared/types';

const RECONNECT_MS = 2000;

/** S'abonne au flux du live. Le dernier état reçu est conservé si la connexion coupe. */
export function useLiveSnapshot(client: 'overlay' | 'other') {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let disposed = false;
    let source: EventSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const open = () => {
      const es = new EventSource(`/api/live/stream?client=${client}`);
      source = es;
      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        // Réponse non 200 (redémarrage du serveur) : le navigateur abandonne, on reconnecte nous-mêmes.
        if (es.readyState === EventSource.CLOSED && !disposed) {
          es.close();
          retry = setTimeout(open, RECONNECT_MS);
        }
      };
      es.onmessage = (ev: MessageEvent<string>) => {
        try {
          setSnapshot(JSON.parse(ev.data) as LiveSnapshot);
          setConnected(true);
        } catch {
          // trame illisible : ignorée
        }
      };
    };
    open();

    return () => {
      disposed = true;
      clearTimeout(retry);
      source?.close();
    };
  }, [client]);

  return { snapshot, connected };
}
