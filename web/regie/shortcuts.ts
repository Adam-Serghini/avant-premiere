import { useEffect, useRef } from 'react';
import { SHORTCUT_ACTIONS, sameKey, type ShortcutAction, type ShortcutMap } from '../../shared/shortcuts';
import type { LiveAction } from '../../shared/types';

const ACTIONS: Record<ShortcutAction, LiveAction> = {
  next: { type: 'next' },
  prev: { type: 'prev' },
  full: { type: 'setMode', mode: 'full' },
  trailer: { type: 'setMode', mode: 'trailer' },
  off: { type: 'setMode', mode: 'off' },
};

/** `code` est la touche physique (`KeyboardEvent.code`) : ça marche en AZERTY comme en QWERTY. */
export function keyToAction(code: string, map: ShortcutMap): LiveAction | null {
  const action = SHORTCUT_ACTIONS.find((a) => sameKey(map[a].code, code));
  return action ? ACTIONS[action] : null;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
}

export function useShortcuts(map: ShortcutMap, onAction: (action: LiveAction) => void, enabled = true): void {
  const latest = useRef({ map, onAction });
  latest.current = { map, onAction };
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const action = keyToAction(e.code, latest.current.map);
      if (!action) return;
      e.preventDefault();
      latest.current.onAction(action);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}
