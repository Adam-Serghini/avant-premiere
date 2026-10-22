import { describe, expect, it } from 'vitest';
import config from '../vite.config';

// Vite redirige vers le serveur tout chemin qui commence par une clé du proxy.
const proxyKeys = Object.keys(config.server?.proxy ?? {});
const isProxied = (path: string) => proxyKeys.some((key) => path.startsWith(key));

describe('proxy de développement', () => {
  it('envoie les appels d’API au serveur', () => {
    expect(isProxied('/api/today')).toBe(true);
    expect(isProxied('/media/0b1c.png')).toBe(true);
    expect(isProxied('/api/live/stream?client=overlay')).toBe(true);
  });

  it('laisse Vite servir les fichiers source dont le nom commence par « api »', () => {
    expect(isProxied('/api.ts')).toBe(false);
  });
});
