import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

afterEach(() => vi.unstubAllGlobals());

function stubFetch() {
  const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const keepalive = (m: ReturnType<typeof stubFetch>) => (m.mock.calls[0] as unknown as [string, RequestInit])[1].keepalive;

describe('patchFilm', () => {
  it('garde keepalive pour un petit envoi', async () => {
    const fetchMock = stubFetch();
    await api.patchFilm('2026-10-13', 'tmdb:1', { opinion: 'court' });
    expect(keepalive(fetchMock)).toBe(true);
  });

  it('retire keepalive au-delà de la limite de Chrome (64 Kio)', async () => {
    const fetchMock = stubFetch();
    await api.patchFilm('2026-10-13', 'tmdb:1', { opinion: 'é'.repeat(40_000) });
    expect(keepalive(fetchMock)).toBe(false);
  });
});
