import type { Film, ReleaseSummary, Trailer } from '../../shared/types';

const IMG = 'https://image.tmdb.org/t/p/';

export interface TmdbListItem {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
}

export interface TmdbDetails {
  id: number;
  imdb_id?: string | null;
  title: string;
  original_title?: string;
  poster_path: string | null;
  overview?: string;
  runtime?: number | null;
  release_date?: string;
  genres?: { name: string }[];
  credits?: {
    cast?: { name: string; order: number }[];
    crew?: { name: string; job: string }[];
  };
  videos?: {
    results?: { key: string; name: string; site: string; type: string; iso_639_1: string | null }[];
  };
  release_dates?: {
    results?: { iso_3166_1: string; release_dates: { release_date: string; type: number }[] }[];
  };
}

const THEATRICAL = new Set([2, 3]);

export function toReleaseSummary(r: TmdbListItem): ReleaseSummary {
  return {
    id: `tmdb:${r.id}`,
    title: r.title,
    posterUrl: r.poster_path ? `${IMG}w342${r.poster_path}` : null,
    year: r.release_date ? r.release_date.slice(0, 4) : null,
  };
}

function frenchReleaseDate(d: TmdbDetails): string | null {
  const fr = d.release_dates?.results?.find((r) => r.iso_3166_1 === 'FR');
  const dates = (fr?.release_dates ?? [])
    .filter((r) => THEATRICAL.has(r.type))
    .map((r) => r.release_date.slice(0, 10))
    .sort();
  return dates[0] ?? null;
}

function trailersOf(d: TmdbDetails): Trailer[] {
  const rank = (t: Trailer) => (t.lang === 'fr' ? 0 : 2) + (t.type === 'Trailer' ? 0 : 1);
  return (d.videos?.results ?? [])
    .filter((v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
    .map((v): Trailer => ({ key: v.key, name: v.name, lang: v.iso_639_1 ?? 'xx', type: v.type as Trailer['type'] }))
    .sort((a, b) => rank(a) - rank(b));
}

export function toFilm(d: TmdbDetails, fetchedAt: string): Film {
  const cast = [...(d.credits?.cast ?? [])].sort((a, b) => a.order - b.order).slice(0, 5).map((c) => c.name);
  const directors = [...new Set((d.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name))];
  return {
    id: `tmdb:${d.id}`,
    source: 'tmdb',
    title: d.title,
    originalTitle: d.original_title && d.original_title !== d.title ? d.original_title : null,
    releaseDateFr: frenchReleaseDate(d),
    posterUrl: d.poster_path ? `${IMG}w780${d.poster_path}` : null,
    customPosterUrl: null,
    localTrailerUrl: null,
    directors,
    cast,
    genres: (d.genres ?? []).map((g) => g.name),
    runtimeMin: d.runtime || null,
    synopsis: d.overview?.trim() || null,
    trailers: trailersOf(d),
    fetchedAt,
    editedFields: [],
    imdbId: d.imdb_id?.trim() || null,
    ratings: null,
  };
}
