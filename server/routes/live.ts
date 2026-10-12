import type { FastifyInstance } from 'fastify';
import type { LiveSnapshot } from '../../shared/types';
import type { AppContext } from '../app';
import { parseLiveAction } from '../live/parse';

const PING_MS = 15_000;

export function registerLiveRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/live', async () => ctx.hub.snapshot());

  app.post('/api/live', async (req) => {
    ctx.live.apply(parseLiveAction(req.body));
    ctx.hub.broadcast();
    return ctx.hub.snapshot();
  });

  app.get('/api/live/stream', (req, reply) => {
    const kind = (req.query as { client?: string }).client === 'overlay' ? 'overlay' : 'other';
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    const send = (snap: LiveSnapshot) => {
      if (res.destroyed) throw new Error('flux fermé');
      res.write(`data: ${JSON.stringify(snap)}\n\n`);
    };
    const remove = ctx.hub.add({ kind, send });
    const ping = setInterval(() => {
      if (!res.destroyed) res.write(': ping\n\n');
    }, PING_MS);
    req.raw.on('close', () => {
      clearInterval(ping);
      remove();
    });
  });
}
