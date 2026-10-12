import type { LiveSnapshot } from '../../shared/types';

export interface LiveClient {
  kind: 'overlay' | 'other';
  send(snapshot: LiveSnapshot): void;
}

export class LiveHub {
  private readonly clients = new Set<LiveClient>();

  constructor(private readonly build: (overlayConnected: boolean) => LiveSnapshot) {}

  add(client: LiveClient): () => void {
    this.clients.add(client);
    this.broadcast();
    return () => {
      if (this.clients.delete(client)) this.broadcast();
    };
  }

  overlayConnected(): boolean {
    for (const c of this.clients) if (c.kind === 'overlay') return true;
    return false;
  }

  snapshot(): LiveSnapshot {
    return this.build(this.overlayConnected());
  }

  broadcast(): void {
    const failed: LiveClient[] = [];
    const snap = this.snapshot();
    for (const c of this.clients) {
      try {
        c.send(snap);
      } catch {
        failed.push(c);
      }
    }
    if (failed.length > 0) {
      for (const c of failed) this.clients.delete(c);
      this.broadcast();
    }
  }
}
