import { SHORTCUT_ACTIONS, sameKey, type KeyBinding, type ShortcutAction, type ShortcutMap } from '../../shared/shortcuts';

export type AssignResult = { map: ShortcutMap } | { conflict: ShortcutAction };

export function assignKey(map: ShortcutMap, action: ShortcutAction, binding: KeyBinding): AssignResult {
  const other = SHORTCUT_ACTIONS.find((a) => a !== action && sameKey(map[a].code, binding.code));
  if (other) return { conflict: other };
  return { map: { ...map, [action]: binding } };
}

export function swapKeys(map: ShortcutMap, a: ShortcutAction, b: ShortcutAction): ShortcutMap {
  return { ...map, [a]: map[b], [b]: map[a] };
}

const NAMED: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ' ': 'Espace',
  Enter: 'Entrée',
  Backspace: 'Retour',
  Delete: 'Suppr',
  PageUp: 'Page ↑',
  PageDown: 'Page ↓',
  Home: 'Début',
  End: 'Fin',
};

export function keyLabel(key: string, code: string): string {
  const named = NAMED[key];
  if (named) return named;
  if (key === 'Dead' || key === 'Unidentified' || key === '') return code.slice(0, 16);
  if (key.length === 1) return key.toUpperCase();
  return key.slice(0, 16);
}
