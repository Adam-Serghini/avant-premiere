import type {
  ApiErrorBody,
  Emission,
  EmissionFilmPatch,
  Film,
  LiveAction,
  LiveSnapshot,
  ManualFilmInput,
  Period,
  Releases,
  ReleaseSummary,
} from '../shared/types';
import type { ShortcutMap } from '../shared/shortcuts';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const enc = encodeURIComponent;

async function request<T>(method: string, path: string, init: { body?: BodyInit; contentType?: string; keepalive?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      keepalive: init.keepalive ?? false,
      headers: init.contentType ? { 'content-type': init.contentType } : undefined,
      body: init.body,
    });
  } catch {
    throw new ApiError(0, 'network', 'Le serveur Avant-Première ne répond pas. Est-il bien lancé ?');
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, err?.error ?? 'error', err?.message ?? `Erreur ${res.status}`);
  }
  return (await res.json()) as T;
}

// Chrome refuse un corps « keepalive » de plus de 64 Kio : au-delà de cette marge, on envoie sans.
const KEEPALIVE_MAX_BYTES = 60_000;

function call<T>(method: string, path: string, body?: unknown, keepalive = false): Promise<T> {
  if (body === undefined) return request<T>(method, path, { keepalive });
  const json = JSON.stringify(body);
  return request<T>(method, path, {
    body: json,
    contentType: 'application/json',
    keepalive: keepalive && new Blob([json]).size < KEEPALIVE_MAX_BYTES,
  });
}

const UPLOAD_LIMITS = {
  poster: { bytes: 20 * 1024 * 1024, message: 'Fichier trop lourd (20 Mo maximum).' },
  trailer: { bytes: 1024 * 1024 * 1024, message: 'Fichier trop lourd (1 Go maximum).' },
} as const;

function upload(filmId: string, kind: 'poster' | 'trailer', file: File): Promise<Film> {
  const limit = UPLOAD_LIMITS[kind];
  // Vérifié avant l'envoi : inutile de faire transiter 2 Go pour se les voir refuser.
  if (file.size > limit.bytes) return Promise.reject(new ApiError(413, 'too_large', limit.message));
  return request<Film>('PUT', `/api/films/${enc(filmId)}/${kind}`, {
    body: file,
    contentType: file.type || 'application/octet-stream',
  });
}

const emissionPath = (date: string) => `/api/emissions/${enc(date)}`;

export const api = {
  today: () => call<{ airDate: string }>('GET', '/api/today'),
  releases: (date: string) => call<Releases>('GET', `/api/releases?date=${enc(date)}`),
  emission: (date: string) => call<Emission>('GET', emissionPath(date)),
  addFilm: (date: string, filmId: string, period: Period) =>
    call<Emission>('POST', `${emissionPath(date)}/films`, { filmId, period }),
  removeFilm: (date: string, filmId: string) => call<Emission>('DELETE', `${emissionPath(date)}/films/${enc(filmId)}`),
  patchFilm: (date: string, filmId: string, patch: EmissionFilmPatch) =>
    call<Emission>('PATCH', `${emissionPath(date)}/films/${enc(filmId)}`, patch, true),
  reorder: (date: string, filmIds: string[]) => call<Emission>('PUT', `${emissionPath(date)}/order`, { filmIds }),
  refreshFilm: (filmId: string) => call<Film>('POST', `/api/films/${enc(filmId)}/refresh`),
  search: (q: string) => call<ReleaseSummary[]>('GET', `/api/search?q=${enc(q)}`),
  createManual: (input: ManualFilmInput) => call<Film>('POST', '/api/films/manual', input),
  updateManual: (filmId: string, input: ManualFilmInput) => call<Film>('PUT', `/api/films/${enc(filmId)}`, input),
  resetFilm: (filmId: string) => call<Film>('DELETE', `/api/films/${enc(filmId)}/overrides`),
  uploadPoster: (filmId: string, file: File) => upload(filmId, 'poster', file),
  uploadTrailer: (filmId: string, file: File) => upload(filmId, 'trailer', file),
  removePoster: (filmId: string) => call<Film>('DELETE', `/api/films/${enc(filmId)}/poster`),
  removeTrailer: (filmId: string) => call<Film>('DELETE', `/api/films/${enc(filmId)}/trailer`),
  live: () => call<LiveSnapshot>('GET', '/api/live'),
  liveAction: (action: LiveAction) => call<LiveSnapshot>('POST', '/api/live', action),
  shortcuts: () => call<ShortcutMap>('GET', '/api/settings/shortcuts'),
  saveShortcuts: (map: ShortcutMap) => call<ShortcutMap>('PUT', '/api/settings/shortcuts', map),
};

export function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Erreur inattendue.';
}
