import type { PlayerCommand } from '../../shared/shortcuts';
import type { Emission, LiveAction, LiveSnapshot, LiveState, PlayerState } from '../../shared/types';
import { effectiveTrailer } from '../../shared/trailer';
import type { Repo } from '../repo';
import { clamp, reduce, type LiveContext, type ReducerAction } from './reducer';

export interface LiveService {
  snapshot(overlayConnected: boolean): LiveSnapshot;
  apply(action: LiveAction): void;
}

const VOLUME_KEY = 'trailerVolume';
const VOLUME_STEP = 10;

export function createLiveService(repo: Repo): LiveService {
  // Après un redémarrage en mode bande-annonce, elle attend l'opérateur au lieu de repartir seule.
  let paused = repo.getLiveState().mode === 'trailer';
  let seek: PlayerState['seek'] = null;
  // Amorcé sur l'horloge : les identifiants ne reculent jamais d'un redémarrage à l'autre.
  let seekId = Date.now();

  function readVolume(): number {
    const raw = repo.getSetting(VOLUME_KEY);
    const n = raw === null || raw.trim() === '' ? NaN : Number(raw);
    return Number.isInteger(n) && n >= 0 && n <= 100 ? n : 100;
  }

  function applyPlayer(command: PlayerCommand, state: LiveState) {
    if (command === 'volumeUp' || command === 'volumeDown') {
      const delta = command === 'volumeUp' ? VOLUME_STEP : -VOLUME_STEP;
      repo.setSetting(VOLUME_KEY, String(Math.min(100, Math.max(0, readVolume() + delta))));
      return;
    }
    if (state.mode !== 'trailer') return;
    if (command === 'togglePause') paused = !paused;
    else seek = { id: ++seekId, kind: command };
  }

  function emissionFor(id: number | null): Emission | null {
    return id === null ? null : repo.getEmissionById(id);
  }

  function contextFor(emission: Emission | null): LiveContext {
    const films = emission?.films ?? [];
    return {
      total: films.length,
      hasTrailerAt: (p) => {
        const ef = films[p];
        return ef !== undefined && effectiveTrailer(ef) !== null;
      },
    };
  }

  function normalize(raw: LiveState, ctx: LiveContext): LiveState {
    const state = clamp(raw, ctx.total);
    if (state.mode === 'trailer' && (state.position !== raw.position || !ctx.hasTrailerAt(state.position))) {
      return { ...state, mode: 'full' };
    }
    return state;
  }

  return {
    snapshot(overlayConnected) {
      const raw = repo.getLiveState();
      const emission = emissionFor(raw.emissionId);
      const films = emission?.films ?? [];
      const state = normalize(raw, contextFor(emission));
      return {
        state,
        total: films.length,
        rundown: films.map((ef) => ({ filmId: ef.film.id, title: ef.film.title, section: ef.section })),
        current: films[state.position] ?? null,
        overlayConnected,
        player: { paused, volume: readVolume(), seek },
      };
    },
    apply(action) {
      const current = repo.getLiveState();
      if (action.type === 'player') {
        const emission = emissionFor(current.emissionId);
        applyPlayer(action.command, normalize(current, contextFor(emission)));
        return;
      }
      let emission: Emission | null;
      let reducerAction: ReducerAction;
      if (action.type === 'start') {
        emission = repo.getEmission(action.airDate);
        reducerAction = { type: 'start', emissionId: emission.id, airDate: emission.airDate };
      } else {
        emission = emissionFor(current.emissionId);
        reducerAction = action;
      }
      const ctx = contextFor(emission);
      const before = normalize(current, ctx);
      const after = reduce(before, reducerAction, ctx);
      const enteredTrailer = after.mode === 'trailer' && before.mode !== 'trailer';
      if (enteredTrailer || after.position !== before.position || after.mode !== 'trailer') {
        paused = false;
        seek = null;
      }
      repo.saveLiveState(after);
    },
  };
}
