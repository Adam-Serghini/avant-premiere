import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Film, ManualFilmInput, TmdbStatus, Trailer } from '../../shared/types';
import type { AppContext } from '../app';
import { isIsoDate, todayInParis, upcomingTuesday } from '../dates';
import { HttpError, parseAirDate } from '../http';
import { RepoError } from '../repo';
import type { TmdbClient } from '../tmdb/client';
import { toFilm, toReleaseSummary } from '../tmdb/mapping';
import { fetchReleases } from '../tmdb/releases';
import { parseYoutubeId } from '../youtube';

export function requireTmdb(ctx: AppContext): TmdbClient {
  if (!ctx.tmdb) {
    throw new HttpError(
      503,
      'tmdb_missing_key',
      'Aucune clé TMDB : ajoute TMDB_API_KEY dans le fichier .env puis relance Avant-Première.',
    );
  }
  return ctx.tmdb;
}

export function parseTmdbId(filmId: string): number | null {
  const m = /^tmdb:(\d+)$/.exec(filmId);
  return m ? Number(m[1]) : null;
}

async function fetchFilm(ctx: AppContext, tmdbId: number): Promise<Film> {
  const film = toFilm(await requireTmdb(ctx).details(tmdbId), ctx.now().toISOString());
  ctx.repo.upsertFilm(film);
  await fetchRatings(ctx, film);
  return ctx.repo.getFilm(film.id)!;
}

/** Notes OMDb : jamais bloquantes. En cas d’échec, les notes précédentes restent en place. */
async function fetchRatings(ctx: AppContext, film: Film): Promise<void> {
  if (!ctx.omdb || !film.imdbId) return;
  try {
    const ratings = await ctx.omdb.ratings(film.imdbId);
    if (ratings) ctx.repo.setFilmRatings(film.id, ratings);
  } catch (e) {
    // Le message d’OmdbError ne contient jamais la clé.
    console.warn(`  ⚠ Notes OMDb indisponibles pour « ${film.title} » : ${e instanceof Error ? e.message : 'erreur inconnue'}`);
  }
}

export async function ensureFilm(ctx: AppContext, filmId: string): Promise<Film> {
  const existing = ctx.repo.getFilm(filmId);
  if (existing) return existing;
  const tmdbId = parseTmdbId(filmId);
  if (tmdbId === null) throw new RepoError('not_found', 'Film inconnu.');
  return fetchFilm(ctx, tmdbId);
}

function buildManualFilm(input: ManualFilmInput, id: string = `manual:${randomUUID()}`): Film {
  const clean = (xs?: string[]) => (xs ?? []).map((s) => s.trim()).filter(Boolean);
  const title = input.title.trim();
  if (!title) throw new HttpError(400, 'invalid_title', 'Le titre est obligatoire.');
  const date = input.releaseDateFr?.trim() || null;
  if (date && !isIsoDate(date)) throw new HttpError(400, 'invalid_date', 'Date de sortie invalide.');
  const poster = input.posterUrl?.trim() || null;
  if (poster && !/^https?:\/\//i.test(poster)) {
    throw new HttpError(400, 'invalid_poster', 'Le lien de l’affiche doit commencer par http:// ou https://.');
  }
  let trailers: Trailer[] = [];
  const trailerUrl = input.trailerUrl?.trim();
  if (trailerUrl) {
    const key = parseYoutubeId(trailerUrl);
    if (!key) throw new HttpError(400, 'invalid_trailer', 'Lien YouTube non reconnu.');
    trailers = [{ key, name: 'Bande-annonce', lang: 'fr', type: 'Trailer' }];
  }
  return {
    id,
    source: 'manual',
    title,
    originalTitle: null,
    releaseDateFr: date,
    posterUrl: poster,
    customPosterUrl: null,
    localTrailerUrl: null,
    directors: clean(input.directors),
    cast: clean(input.cast).slice(0, 5),
    genres: clean(input.genres),
    runtimeMin: input.runtimeMin ?? null,
    synopsis: input.synopsis?.trim() || null,
    trailers,
    fetchedAt: null,
    editedFields: [],
    imdbId: null,
    ratings: null,
  };
}

const stringList = { type: 'array', items: { type: 'string', maxLength: 200 }, maxItems: 20 } as const;

const manualSchema = {
  type: 'object',
  required: ['title'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    releaseDateFr: { type: 'string', maxLength: 10 },
    directors: stringList,
    cast: stringList,
    posterUrl: { type: 'string', maxLength: 2000 },
    trailerUrl: { type: 'string', maxLength: 2000 },
    genres: stringList,
    runtimeMin: { type: 'integer', minimum: 1, maximum: 999 },
    synopsis: { type: 'string', maxLength: 5000 },
  },
} as const;

export function registerCatalogRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/health', async (): Promise<{ tmdb: TmdbStatus }> => ({
    tmdb: ctx.tmdb ? await ctx.tmdb.checkKey() : 'missing',
  }));

  app.get('/api/today', async () => ({ airDate: upcomingTuesday(todayInParis(ctx.now())) }));

  app.get('/api/releases', async (req) => {
    const { date = '' } = req.query as { date?: string };
    const airDate = parseAirDate(date);
    return fetchReleases(requireTmdb(ctx), airDate);
  });

  app.get('/api/search', async (req) => {
    const q = String((req.query as { q?: string }).q ?? '').trim();
    if (q.length < 2) return [];
    const page = await requireTmdb(ctx).search(q);
    return page.results.slice(0, 20).map(toReleaseSummary);
  });

  app.post('/api/films/manual', { schema: { body: manualSchema } }, async (req, reply) => {
    const film = buildManualFilm(req.body as ManualFilmInput);
    ctx.repo.upsertFilm(film);
    return reply.code(201).send(film);
  });

  app.put('/api/films/:filmId', { schema: { body: manualSchema } }, async (req) => {
    const { filmId } = req.params as { filmId: string };
    const existing = ctx.repo.getFilm(filmId);
    if (!existing) throw new RepoError('not_found', 'Film inconnu.');
    const built = buildManualFilm(req.body as ManualFilmInput, filmId);
    if (existing.source === 'manual') {
      ctx.repo.upsertFilm(built);
      ctx.hub.broadcast();
      return ctx.repo.getFilm(filmId);
    }
    // Fiche TMDB : seules les différences avec TMDB sont gardées, et elles survivent à l’actualisation.
    const trailer = built.trailers[0];
    const film = ctx.repo.editFilm(filmId, {
      title: built.title,
      releaseDateFr: built.releaseDateFr,
      directors: built.directors,
      cast: built.cast,
      genres: built.genres,
      runtimeMin: built.runtimeMin,
      synopsis: built.synopsis,
      extraTrailer: trailer && { key: trailer.key, name: 'Bande-annonce ajoutée', lang: 'fr', type: 'Trailer' },
    });
    ctx.hub.broadcast();
    return film;
  });

  app.delete('/api/films/:filmId/overrides', async (req) => {
    const { filmId } = req.params as { filmId: string };
    const film = ctx.repo.clearFilmOverrides(filmId);
    ctx.hub.broadcast();
    return film;
  });

  app.post('/api/films/:filmId/refresh', async (req) => {
    const { filmId } = req.params as { filmId: string };
    const tmdbId = parseTmdbId(filmId);
    if (tmdbId === null) throw new HttpError(400, 'not_tmdb', 'Seules les fiches TMDB peuvent être actualisées.');
    const film = await fetchFilm(ctx, tmdbId);
    ctx.hub.broadcast();
    return film;
  });
}
