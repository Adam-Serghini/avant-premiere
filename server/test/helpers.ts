import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import type { DateRange } from '../../shared/types';
import { buildApp } from '../app';
import { openDb } from '../db';
import { createRepo } from '../repo';
import type { TmdbClient } from '../tmdb/client';
import { detailsFixture } from '../tmdb/fixtures';

export function fakeTmdb(overrides: Partial<TmdbClient> = {}) {
  const client = {
    discover: vi.fn(async (range: DateRange) => {
      const past = range.from === '2026-10-07';
      return {
        total_pages: 1,
        results: [{ id: past ? 1001 : 2001, title: past ? 'Film passé' : 'Film à venir', poster_path: null }],
      };
    }),
    details: vi.fn(async (id: number) => ({ ...detailsFixture, id })),
    search: vi.fn(async () => ({
      total_pages: 1,
      results: [{ id: 3001, title: 'Ressortie', poster_path: '/r.jpg', release_date: '1967-10-25' }],
    })),
    checkKey: vi.fn(async () => 'ok' as const),
    ...overrides,
  };
  return client;
}

export async function makeApp(opts: { tmdb?: TmdbClient | null } = {}) {
  const repo = createRepo(openDb(':memory:'));
  const tmdb = opts.tmdb === undefined ? fakeTmdb() : opts.tmdb;
  const mediaDir = mkdtempSync(join(tmpdir(), 'avant-premiere-media-'));
  const app = await buildApp({ repo, tmdb, mediaDir, now: () => new Date('2026-10-07T10:00:00Z') });
  return { app, repo, tmdb, mediaDir };
}
