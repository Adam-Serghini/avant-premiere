import type { DisplayMode, LiveAction } from '../../shared/types';
import { isIsoDate } from '../dates';
import { HttpError } from '../http';

const MODES: readonly DisplayMode[] = ['card', 'full', 'trailer', 'off'];

export function parseLiveAction(body: unknown): LiveAction {
  const b = (body ?? {}) as Record<string, unknown>;
  switch (b.type) {
    case 'next':
    case 'prev':
    case 'trailerEnded':
      return { type: b.type };
    case 'goto':
      if (Number.isInteger(b.position)) return { type: 'goto', position: b.position as number };
      break;
    case 'setMode':
      if (MODES.includes(b.mode as DisplayMode)) return { type: 'setMode', mode: b.mode as DisplayMode };
      break;
    case 'start':
      if (typeof b.airDate === 'string' && isIsoDate(b.airDate)) return { type: 'start', airDate: b.airDate };
      break;
  }
  throw new HttpError(400, 'invalid_action', 'Action de régie invalide.');
}
