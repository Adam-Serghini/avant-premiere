import type { EmissionFilm, Trailer } from './types';

const isFrench = (t: Trailer) => t.lang === 'fr' || /vost/i.test(t.name);

/** Bandes-annonces proposées : la VF et la VOST seulement, ou la VO en secours ; jamais les teasers. */
export function selectTrailers(trailers: Trailer[]): Trailer[] {
  const full = trailers.filter((t) => t.type === 'Trailer');
  const french = full.filter(isFrench);
  return french.length > 0 ? french : full;
}

export function defaultTrailerKey(trailers: Trailer[]): string | null {
  return (trailers.find((t) => t.lang === 'fr') ?? trailers[0])?.key ?? null;
}

export const LOCAL_TRAILER = 'local';

export type EffectiveTrailer = { kind: 'youtube'; key: string } | { kind: 'local'; url: string } | null;

/** La bande-annonce qui passera : le choix enregistré s'il existe encore, sinon la vidéo locale, sinon la VF. */
export function effectiveTrailer(ef: EmissionFilm): EffectiveTrailer {
  const { film, trailerKey } = ef;
  if (trailerKey === LOCAL_TRAILER && film.localTrailerUrl) return { kind: 'local', url: film.localTrailerUrl };
  if (trailerKey && film.trailers.some((t) => t.key === trailerKey)) return { kind: 'youtube', key: trailerKey };
  if (film.localTrailerUrl) return { kind: 'local', url: film.localTrailerUrl };
  const key = defaultTrailerKey(film.trailers);
  return key ? { kind: 'youtube', key } : null;
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
