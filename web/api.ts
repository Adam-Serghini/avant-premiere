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

async function call<T>(method: string, path: string, body?: unknown, keepalive = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      keepalive,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
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

const enc = encodeURIComponent;
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
  live: () => call<LiveSnapshot>('GET', '/api/live'),
  liveAction: (action: LiveAction) => call<LiveSnapshot>('POST', '/api/live', action),
};

export function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Erreur inattendue.';
}
