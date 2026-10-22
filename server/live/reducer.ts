import type { DisplayMode, LiveAction, LiveState } from '../../shared/types';

export type ReducerAction =
  | Exclude<LiveAction, { type: 'start' }>
  | { type: 'start'; emissionId: number; airDate: string };

export interface LiveContext {
  total: number;
  hasTrailerAt(position: number): boolean;
}

export function clamp(state: LiveState, total: number): LiveState {
  const last = Math.max(0, total - 1);
  return state.position > last ? { ...state, position: last } : state;
}

function moveTo(state: LiveState, position: number): LiveState {
  if (position === state.position) return state;
  const mode: DisplayMode = state.mode === 'trailer' ? 'full' : state.mode;
  return { ...state, position, mode };
}

export function reduce(state: LiveState, action: ReducerAction, ctx: LiveContext): LiveState {
  const last = Math.max(0, ctx.total - 1);
  switch (action.type) {
    case 'start':
      if (state.emissionId === action.emissionId) return clamp(state, ctx.total);
      return { emissionId: action.emissionId, airDate: action.airDate, position: 0, mode: 'full' };
    case 'next':
      return moveTo(state, Math.min(state.position + 1, last));
    case 'prev':
      return moveTo(state, Math.max(state.position - 1, 0));
    case 'goto':
      if (!Number.isInteger(action.position) || action.position < 0 || action.position >= ctx.total) return state;
      return moveTo(state, action.position);
    case 'setMode':
      if (action.mode === state.mode) return state;
      if (action.mode === 'trailer' && !ctx.hasTrailerAt(state.position)) return state;
      return { ...state, mode: action.mode };
    case 'trailerEnded':
      return state.mode === 'trailer' ? { ...state, mode: 'full' } : state;
  }
}
