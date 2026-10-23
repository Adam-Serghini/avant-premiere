export type Period = 'past' | 'next';
export type DisplayMode = 'full' | 'trailer' | 'off';
export type TmdbStatus = 'ok' | 'missing' | 'invalid' | 'unavailable';

export interface DateRange {
  from: string;
  to: string;
}

export interface Trailer {
  key: string;
  name: string;
  lang: string;
  type: 'Trailer' | 'Teaser';
}

export type EditableField =
  | 'title'
  | 'releaseDateFr'
  | 'directors'
  | 'cast'
  | 'genres'
  | 'runtimeMin'
  | 'synopsis'
  | 'extraTrailer';

/** Corrections de l’utilisateur sur une fiche TMDB ; chaque champ présent remplace la valeur de TMDB. */
export interface FilmOverrides {
  title?: string;
  releaseDateFr?: string | null;
  directors?: string[];
  cast?: string[];
  genres?: string[];
  runtimeMin?: number | null;
  synopsis?: string | null;
  extraTrailer?: Trailer;
}

export interface Film {
  id: string;
  source: 'tmdb' | 'manual';
  title: string;
  originalTitle: string | null;
  releaseDateFr: string | null;
  posterUrl: string | null;
  /** Affiche choisie par l’utilisateur ; prioritaire sur `posterUrl`, jamais écrasée par TMDB. */
  customPosterUrl: string | null;
  /** Vidéo de l’ordinateur pour la bande-annonce. */
  localTrailerUrl: string | null;
  directors: string[];
  cast: string[];
  genres: string[];
  runtimeMin: number | null;
  synopsis: string | null;
  trailers: Trailer[];
  fetchedAt: string | null;
  /** Champs corrigés par l’utilisateur (fiche TMDB) ; toujours vide pour une fiche manuelle. */
  editedFields: EditableField[];
}

export interface ReleaseSummary {
  id: string;
  title: string;
  posterUrl: string | null;
  year: string | null;
}

export interface PeriodReleases extends DateRange {
  films: ReleaseSummary[];
}

export interface Releases {
  airDate: string;
  past: PeriodReleases;
  next: PeriodReleases;
}

export interface EmissionFilm {
  film: Film;
  position: number;
  period: Period;
  opinion: string;
  anecdotes: string;
  extendedUniverse: string;
  score: number | null;
  trailerKey: string | null;
}

export interface Emission {
  id: number;
  airDate: string;
  films: EmissionFilm[];
}

export interface EmissionFilmPatch {
  opinion?: string;
  anecdotes?: string;
  extendedUniverse?: string;
  score?: number | null;
  trailerKey?: string | null;
}

export interface ManualFilmInput {
  title: string;
  releaseDateFr?: string;
  directors?: string[];
  cast?: string[];
  posterUrl?: string;
  trailerUrl?: string;
  genres?: string[];
  runtimeMin?: number;
  synopsis?: string;
}

export interface LiveState {
  emissionId: number | null;
  airDate: string | null;
  position: number;
  mode: DisplayMode;
}

export interface RundownItem {
  filmId: string;
  title: string;
}

export interface LiveSnapshot {
  state: LiveState;
  total: number;
  rundown: RundownItem[];
  current: EmissionFilm | null;
  overlayConnected: boolean;
}

export type LiveAction =
  | { type: 'start'; airDate: string }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goto'; position: number }
  | { type: 'setMode'; mode: DisplayMode }
  | { type: 'trailerEnded' };

export interface ApiErrorBody {
  error: string;
  message: string;
}
