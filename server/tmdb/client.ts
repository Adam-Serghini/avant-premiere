import type { DateRange } from '../../shared/types';
import type { TmdbDetails, TmdbListItem } from './mapping';

export type TmdbErrorKind = 'auth' | 'unavailable' | 'not_found';

export class TmdbError extends Error {
  constructor(
    public readonly kind: TmdbErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'TmdbError';
  }
}

export interface TmdbPage<T> {
  results: T[];
  total_pages: number;
}

export interface TmdbClient {
  discover(range: DateRange, page: number): Promise<TmdbPage<TmdbListItem>>;
  details(tmdbId: number): Promise<TmdbDetails>;
  search(query: string): Promise<TmdbPage<TmdbListItem>>;
  checkKey(): Promise<'ok' | 'invalid' | 'unavailable'>;
}

export interface TmdbClientOptions {
  apiKey: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
}

export function createTmdbClient({
  apiKey,
  fetchFn = fetch,
  timeoutMs = 8000,
  baseUrl = 'https://api.themoviedb.org/3',
}: TmdbClientOptions): TmdbClient {
  const bearer = apiKey.startsWith('eyJ');

  async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(baseUrl + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (bearer) headers.authorization = `Bearer ${apiKey}`;
    else url.searchParams.set('api_key', apiKey);

    let res: Response;
    try {
      res = await fetchFn(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new TmdbError('unavailable', 'TMDB ne répond pas.');
    }
    if (res.status === 401) throw new TmdbError('auth', 'Clé TMDB refusée.');
    if (res.status === 404) throw new TmdbError('not_found', 'Introuvable sur TMDB.');
    if (!res.ok) throw new TmdbError('unavailable', `TMDB a répondu ${res.status}.`);
    try {
      return (await res.json()) as T;
    } catch {
      throw new TmdbError('unavailable', 'Réponse TMDB illisible.');
    }
  }

  return {
    discover: (range, page) =>
      get('/discover/movie', {
        region: 'FR',
        with_release_type: '2|3',
        'release_date.gte': range.from,
        'release_date.lte': range.to,
        language: 'fr-FR',
        sort_by: 'popularity.desc',
        include_adult: 'false',
        page: String(page),
      }),
    details: (tmdbId) =>
      get(`/movie/${tmdbId}`, {
        language: 'fr-FR',
        append_to_response: 'credits,videos,release_dates',
        include_video_language: 'fr,en,null',
      }),
    search: (query) => get('/search/movie', { query, language: 'fr-FR', include_adult: 'false' }),
    async checkKey() {
      try {
        await get('/configuration');
        return 'ok';
      } catch (e) {
        return e instanceof TmdbError && e.kind === 'auth' ? 'invalid' : 'unavailable';
      }
    },
  };
}
