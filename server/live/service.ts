import type { Emission, LiveAction, LiveSnapshot, LiveState } from '../../shared/types';
import { effectiveTrailerKey } from '../../shared/trailer';
import type { Repo } from '../repo';
import { clamp, reduce, type LiveContext, type ReducerAction } from './reducer';

export interface LiveService {
  snapshot(overlayConnected: boolean): LiveSnapshot;
  apply(action: LiveAction): void;
}

export function createLiveService(repo: Repo): LiveService {
  function emissionFor(id: number | null): Emission | null {
    return id === null ? null : repo.getEmissionById(id);
  }

  function contextFor(emission: Emission | null): LiveContext {
    const films = emission?.films ?? [];
    return {
      total: films.length,
      hasTrailerAt: (p) => {
        const ef = films[p];
        return ef !== undefined && effectiveTrailerKey(ef) !== null;
      },
    };
  }

  function normalize(raw: LiveState, ctx: LiveContext): LiveState {
    const state = clamp(raw, ctx.total);
    if (state.mode === 'trailer' && (state.position !== raw.position || !ctx.hasTrailerAt(state.position))) {
      return { ...state, mode: 'card' };
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
        rundown: films.map((ef) => ({ filmId: ef.film.id, title: ef.film.title })),
        current: films[state.position] ?? null,
        overlayConnected,
      };
    },
    apply(action) {
      const current = repo.getLiveState();
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
      repo.saveLiveState(reduce(normalize(current, ctx), reducerAction, ctx));
    },
  };
}
