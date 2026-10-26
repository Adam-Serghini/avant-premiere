import type { FastifyInstance } from 'fastify';
import { DEFAULT_SHORTCUTS, upgradeShortcuts, validateShortcuts, type ShortcutMap } from '../../shared/shortcuts';
import type { AppContext } from '../app';
import { HttpError } from '../http';
import type { Repo } from '../repo';

const KEY = 'shortcuts';

function readShortcuts(repo: Repo): ShortcutMap {
  const raw = repo.getSetting(KEY);
  if (raw === null) return DEFAULT_SHORTCUTS;
  try {
    const result = validateShortcuts(upgradeShortcuts(JSON.parse(raw)));
    return result.ok ? result.map : DEFAULT_SHORTCUTS;
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

export function registerSettingsRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/settings/shortcuts', async () => readShortcuts(ctx.repo));

  app.put('/api/settings/shortcuts', async (req) => {
    const result = validateShortcuts(req.body);
    if (!result.ok) throw new HttpError(400, 'invalid_shortcuts', result.message);
    ctx.repo.setSetting(KEY, JSON.stringify(result.map));
    return result.map;
  });
}
