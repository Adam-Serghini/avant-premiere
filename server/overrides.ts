import type { EditableField, Film, FilmOverrides } from '../shared/types';

export const EDITABLE_FIELDS: EditableField[] = [
  'title',
  'releaseDateFr',
  'directors',
  'cast',
  'genres',
  'runtimeMin',
  'synopsis',
  'extraTrailer',
];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Ne garde du candidat que ce qui diffère de la fiche de base (TMDB) : le reste n’est pas une correction. */
export function diffOverrides(base: Film, candidate: FilmOverrides): FilmOverrides {
  const out: FilmOverrides = {};
  for (const field of EDITABLE_FIELDS) {
    if (field === 'extraTrailer') {
      const t = candidate.extraTrailer;
      if (t && !base.trailers.some((b) => b.key === t.key)) out.extraTrailer = t;
    } else if (candidate[field] !== undefined && !same(candidate[field], base[field])) {
      Object.assign(out, { [field]: candidate[field] });
    }
  }
  return out;
}

/** Applique les corrections sur la fiche de base. */
export function applyOverrides(base: Film, o: FilmOverrides): Film {
  const film: Film = { ...base };
  const edited: EditableField[] = [];
  for (const field of EDITABLE_FIELDS) {
    if (o[field] === undefined) continue;
    edited.push(field);
    if (field === 'extraTrailer') {
      const t = o.extraTrailer!;
      if (!film.trailers.some((b) => b.key === t.key)) film.trailers = [...film.trailers, t];
    } else {
      Object.assign(film, { [field]: o[field] });
    }
  }
  film.editedFields = edited;
  return film;
}

export function parseOverrides(json: string): FilmOverrides {
  try {
    const v: unknown = JSON.parse(json);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as FilmOverrides) : {};
  } catch {
    return {};
  }
}
