import { useEffect, useRef } from 'react';
import type { LiveAction } from '../../shared/types';

export function keyToAction(key: string): LiveAction | null {
  switch (key) {
    case 'ArrowRight':
      return { type: 'next' };
    case 'ArrowLeft':
      return { type: 'prev' };
    case '1':
      return { type: 'setMode', mode: 'full' };
    case '2':
      return { type: 'setMode', mode: 'trailer' };
    case '3':
      return { type: 'setMode', mode: 'off' };
    default:
      return null;
  }
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
}

export function useShortcuts(onAction: (action: LiveAction) => void): void {
  const ref = useRef(onAction);
  ref.current = onAction;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const action = keyToAction(e.key);
      if (!action) return;
      e.preventDefault();
      ref.current(action);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
