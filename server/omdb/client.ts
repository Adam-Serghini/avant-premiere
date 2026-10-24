import type { Ratings } from '../../shared/types';

export class OmdbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OmdbError';
  }
}

export interface OmdbClient {
  ratings(imdbId: string): Promise<Ratings | null>;
}

export interface OmdbClientOptions {
  apiKey: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
}

const MISSING = 'N/A';

function numberOf(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text || text === MISSING) return null;
  const n = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Lit la réponse d’OMDb ; null quand le film est inconnu ou qu’aucune note n’est disponible. */
export function parseOmdbRatings(body: unknown): Ratings | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.Response === 'False') return null;
  const list = Array.isArray(b.Ratings) ? (b.Ratings as { Source?: unknown; Value?: unknown }[]) : [];
  const valueOf = (source: string) => list.find((r) => r?.Source === source)?.Value;
  const ratings: Ratings = {
    imdb: numberOf(b.imdbRating),
    rottenTomatoes: numberOf(valueOf('Rotten Tomatoes')),
    metacritic: numberOf(b.Metascore) ?? numberOf(valueOf('Metacritic')),
  };
  return ratings.imdb === null && ratings.rottenTomatoes === null && ratings.metacritic === null ? null : ratings;
}

export function createOmdbClient({
  apiKey,
  fetchFn = fetch,
  timeoutMs = 8000,
  baseUrl = 'https://www.omdbapi.com/',
}: OmdbClientOptions): OmdbClient {
  return {
    async ratings(imdbId) {
      const url = new URL(baseUrl);
      url.searchParams.set('i', imdbId);
      url.searchParams.set('apikey', apiKey);
      let res: Response;
      try {
        res = await fetchFn(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
      } catch {
        // Le message ne reprend jamais l’adresse : elle contient la clé.
        throw new OmdbError('OMDb ne répond pas.');
      }
      if (!res.ok) throw new OmdbError(`OMDb a répondu ${res.status}.`);
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new OmdbError('Réponse OMDb illisible.');
      }
      return parseOmdbRatings(body);
    },
  };
}
