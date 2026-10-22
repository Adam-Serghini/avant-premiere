import { existsSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { toHttpError } from './http';
import { LiveHub } from './live/hub';
import { createLiveService, type LiveService } from './live/service';
import type { Repo } from './repo';
import { registerCatalogRoutes } from './routes/catalog';
import { registerEmissionRoutes } from './routes/emissions';
import { registerLiveRoutes } from './routes/live';
import { registerSettingsRoutes } from './routes/settings';
import type { TmdbClient } from './tmdb/client';

export interface AppDeps {
  repo: Repo;
  tmdb: TmdbClient | null;
  now?: () => Date;
  staticDir?: string;
}

export interface AppContext {
  repo: Repo;
  tmdb: TmdbClient | null;
  now: () => Date;
  live: LiveService;
  hub: LiveHub;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ forceCloseConnections: true });
  const live = createLiveService(deps.repo);
  const ctx: AppContext = {
    repo: deps.repo,
    tmdb: deps.tmdb,
    now: deps.now ?? (() => new Date()),
    live,
    hub: new LiveHub((overlayConnected) => live.snapshot(overlayConnected)),
  };

  app.setErrorHandler((err, _req, reply) => {
    const { status, body } = toHttpError(err);
    void reply.code(status).send(body);
  });

  registerCatalogRoutes(app, ctx);
  registerEmissionRoutes(app, ctx);
  registerLiveRoutes(app, ctx);
  registerSettingsRoutes(app, ctx);

  if (deps.staticDir && existsSync(deps.staticDir)) {
    await app.register(fastifyStatic, { root: deps.staticDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
      return reply.code(404).send({ error: 'not_found', message: 'Route inconnue.' });
    });
  }

  return app;
}
