import type { DateRange, Releases, ReleaseSummary } from '../../shared/types';
import { periodsFor } from '../dates';
import type { TmdbClient } from './client';
import { toReleaseSummary } from './mapping';

export const MAX_PAGES = 5;

async function fetchRange(tmdb: TmdbClient, range: DateRange): Promise<ReleaseSummary[]> {
  const first = await tmdb.discover(range, 1);
  const pages = Math.min(first.total_pages, MAX_PAGES);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) => tmdb.discover(range, i + 2)),
  );
  const seen = new Set<number>();
  const unique = [first, ...rest]
    .flatMap((p) => p.results)
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  return unique.map(toReleaseSummary);
}

export async function fetchReleases(tmdb: TmdbClient, airDate: string): Promise<Releases> {
  const periods = periodsFor(airDate);
  const [past, next] = await Promise.all([fetchRange(tmdb, periods.past), fetchRange(tmdb, periods.next)]);
  return { airDate, past: { ...periods.past, films: past }, next: { ...periods.next, films: next } };
}
