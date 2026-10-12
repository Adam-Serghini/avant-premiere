import { describe, expect, it, vi } from 'vitest';
import type { DateRange } from '../../shared/types';
import type { TmdbClient } from './client';
import { fetchReleases, MAX_PAGES } from './releases';

function fakeClient(totalPages: number) {
  const client = {
    discover: vi.fn(async (range: DateRange, page: number) => ({
      total_pages: totalPages,
      results: [
        { id: page * 10 + (range.from === '2026-10-07' ? 1 : 2), title: `Film ${page}`, poster_path: null },
        { id: 999, title: 'Doublon', poster_path: null },
      ],
    })),
    details: vi.fn(),
    search: vi.fn(),
    checkKey: vi.fn(),
  };
  return client as typeof client & TmdbClient;
}

describe('fetchReleases', () => {
  it('interroge les deux périodes de l’émission', async () => {
    const releases = await fetchReleases(fakeClient(1), '2026-10-13');
    expect(releases.airDate).toBe('2026-10-13');
    expect(releases.past).toMatchObject({ from: '2026-10-07', to: '2026-10-13' });
    expect(releases.next).toMatchObject({ from: '2026-10-14', to: '2026-10-20' });
    expect(releases.past.films.map((f) => f.id)).toEqual(['tmdb:11', 'tmdb:999']);
    expect(releases.next.films.map((f) => f.id)).toEqual(['tmdb:12', 'tmdb:999']);
  });

  it(`s’arrête à ${MAX_PAGES} pages par période et supprime les doublons`, async () => {
    const client = fakeClient(8);
    const releases = await fetchReleases(client, '2026-10-13');
    expect(client.discover).toHaveBeenCalledTimes(MAX_PAGES * 2);
    expect(releases.past.films).toHaveLength(MAX_PAGES + 1);
    expect(new Set(releases.past.films.map((f) => f.id)).size).toBe(releases.past.films.length);
  });
});
