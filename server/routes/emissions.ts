import type { FastifyInstance, FastifyRequest } from 'fastify';
import { SECTIONS, type Section } from '../../shared/sections';
import type { EmissionFilmPatch } from '../../shared/types';
import type { AppContext } from '../app';
import { parseAirDate } from '../http';
import { ensureFilm } from './catalog';

const addSchema = {
  type: 'object',
  required: ['filmId', 'section'],
  additionalProperties: false,
  properties: {
    filmId: { type: 'string', minLength: 1, maxLength: 200 },
    section: { type: 'string', enum: SECTIONS },
  },
} as const;

const patchSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    section: { type: 'string', enum: SECTIONS },
    opinion: { type: 'string', maxLength: 20000 },
    anecdotes: { type: 'string', maxLength: 20000 },
    extendedUniverse: { type: 'string', maxLength: 20000 },
    score: { type: ['integer', 'null'] },
    trailerKey: { type: ['string', 'null'], maxLength: 100 },
  },
} as const;

const orderSchema = {
  type: 'object',
  required: ['filmIds'],
  additionalProperties: false,
  properties: { filmIds: { type: 'array', items: { type: 'string' }, maxItems: 200 } },
} as const;

function dateParam(req: FastifyRequest): string {
  return parseAirDate((req.params as { date: string }).date);
}

function filmParam(req: FastifyRequest): string {
  return (req.params as { filmId: string }).filmId;
}

export function registerEmissionRoutes(app: FastifyInstance, ctx: AppContext): void {
  const base = '/api/emissions/:date';

  app.get(base, async (req) => ctx.repo.getEmission(dateParam(req)));

  app.post(`${base}/films`, { schema: { body: addSchema } }, async (req) => {
    const date = dateParam(req);
    const { filmId, section } = req.body as { filmId: string; section: Section };
    await ensureFilm(ctx, filmId);
    const emission = ctx.repo.addFilm(date, filmId, section);
    ctx.hub.broadcast();
    return emission;
  });

  app.delete(`${base}/films/:filmId`, async (req) => {
    const emission = ctx.repo.removeFilm(dateParam(req), filmParam(req));
    ctx.hub.broadcast();
    return emission;
  });

  app.patch(`${base}/films/:filmId`, { schema: { body: patchSchema } }, async (req) => {
    const emission = ctx.repo.updateFilm(dateParam(req), filmParam(req), req.body as EmissionFilmPatch);
    ctx.hub.broadcast();
    return emission;
  });

  app.put(`${base}/order`, { schema: { body: orderSchema } }, async (req) => {
    const { filmIds } = req.body as { filmIds: string[] };
    const emission = ctx.repo.reorder(dateParam(req), filmIds);
    ctx.hub.broadcast();
    return emission;
  });
}
