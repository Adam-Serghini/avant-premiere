import type { EmissionFilm, Trailer } from './types';

export function defaultTrailerKey(trailers: Trailer[]): string | null {
  return (trailers.find((t) => t.lang === 'fr') ?? trailers[0])?.key ?? null;
}

export function effectiveTrailerKey(ef: EmissionFilm): string | null {
  if (ef.trailerKey && ef.film.trailers.some((t) => t.key === ef.trailerKey)) return ef.trailerKey;
  return defaultTrailerKey(ef.film.trailers);
}

export function trailerLabel(t: Trailer): string {
  if (t.type === 'Teaser') return 'Teaser';
  if (/vost/i.test(t.name)) return 'VOST';
  return t.lang === 'fr' ? 'VF' : 'VO';
}

export function trailerLabels(trailers: Trailer[]): string[] {
  const seen = new Map<string, number>();
  return trailers.map((t) => {
    const base = trailerLabel(t);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} ${n}`;
  });
}
