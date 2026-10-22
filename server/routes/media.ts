import type { Readable } from 'node:stream';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Film } from '../../shared/types';
import type { AppContext } from '../app';
import { invalidType, type MediaKind } from '../media';
import { RepoError } from '../repo';

const KINDS: readonly MediaKind[] = ['poster', 'trailer'];

const current = (film: Film, kind: MediaKind) => (kind === 'poster' ? film.customPosterUrl : film.localTrailerUrl);

function existingFilm(ctx: AppContext, req: FastifyRequest): Film {
  const { filmId } = req.params as { filmId: string };
  const film = ctx.repo.getFilm(filmId);
  if (!film) throw new RepoError('not_found', 'Film inconnu.');
  return film;
}

function isStream(body: unknown): body is Readable {
  return typeof (body as Readable | null)?.pipe === 'function';
}

export function registerMediaRoutes(app: FastifyInstance, ctx: AppContext): void {
  for (const kind of KINDS) {
    app.put(`/api/films/:filmId/${kind}`, async (req) => {
      const body = req.body;
      let film: Film;
      try {
        film = existingFilm(ctx, req);
      } catch (err) {
        if (isStream(body)) body.resume();
        throw err;
      }
      if (!isStream(body)) throw invalidType(kind);
      const length = Number(req.headers['content-length']);
      const mediaUrl = await ctx.media.save(kind, req.headers['content-type'], body, Number.isFinite(length) ? length : undefined);
      const updated = ctx.repo.setFilmMedia(film.id, kind, mediaUrl);
      ctx.media.remove(current(film, kind));
      ctx.hub.broadcast();
      return updated;
    });

    app.delete(`/api/films/:filmId/${kind}`, async (req) => {
      const film = existingFilm(ctx, req);
      const updated = ctx.repo.setFilmMedia(film.id, kind, null);
      ctx.media.remove(current(film, kind));
      ctx.hub.broadcast();
      return updated;
    });
  }
}
