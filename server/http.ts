import type { ApiErrorBody } from '../shared/types';
import { isIsoDate } from './dates';
import { RepoError } from './repo';
import { TmdbError } from './tmdb/client';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const TMDB_ERRORS = {
  auth: { status: 502, error: 'tmdb_auth', message: 'La clé TMDB est refusée : vérifie TMDB_API_KEY dans le fichier .env.' },
  unavailable: { status: 503, error: 'tmdb_unavailable', message: 'TMDB ne répond pas, réessaie.' },
  not_found: { status: 404, error: 'tmdb_not_found', message: 'Film introuvable sur TMDB.' },
} as const;

export function toHttpError(err: unknown): { status: number; body: ApiErrorBody } {
  if (err instanceof HttpError) return { status: err.status, body: { error: err.code, message: err.message } };
  if (err instanceof RepoError) {
    return { status: err.code === 'not_found' ? 404 : 400, body: { error: err.code, message: err.message } };
  }
  if (err instanceof TmdbError) {
    const { status, error, message } = TMDB_ERRORS[err.kind];
    return { status, body: { error, message } };
  }
  const statusCode = (err as { statusCode?: unknown } | null)?.statusCode;
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
    return { status: statusCode, body: { error: 'invalid', message: 'Requête invalide.' } };
  }
  console.error(err);
  return { status: 500, body: { error: 'internal', message: 'Erreur interne : regarde la fenêtre du serveur.' } };
}

export function parseAirDate(raw: string): string {
  if (!isIsoDate(raw)) {
    throw new HttpError(400, 'invalid_date', `Date invalide : « ${raw} » (format attendu AAAA-MM-JJ).`);
  }
  return raw;
}
