// @vitest-environment jsdom
import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHORTCUTS } from '../../shared/shortcuts';
import { keyToAction, useShortcuts } from './shortcuts';

describe('raccourcis de la régie', () => {
  it('reconnaît la touche physique, quel que soit le clavier', () => {
    expect(keyToAction('ArrowRight', DEFAULT_SHORTCUTS)).toEqual({ type: 'next' });
    expect(keyToAction('ArrowLeft', DEFAULT_SHORTCUTS)).toEqual({ type: 'prev' });
    expect(keyToAction('Digit1', DEFAULT_SHORTCUTS)).toEqual({ type: 'setMode', mode: 'full' });
    expect(keyToAction('Numpad2', DEFAULT_SHORTCUTS)).toEqual({ type: 'setMode', mode: 'trailer' });
    expect(keyToAction('Digit3', DEFAULT_SHORTCUTS)).toEqual({ type: 'setMode', mode: 'off' });
    expect(keyToAction('KeyX', DEFAULT_SHORTCUTS)).toBeNull();
  });

  it('suit une carte personnalisée', () => {
    const map = { ...DEFAULT_SHORTCUTS, next: { code: 'KeyN', label: 'N' } };
    expect(keyToAction('KeyN', map)).toEqual({ type: 'next' });
    expect(keyToAction('ArrowRight', map)).toBeNull();
  });

  it('déclenche l’action en AZERTY (la touche 1 produit « & »)', () => {
    const onAction = vi.fn();
    const { unmount } = renderHook(() => useShortcuts(DEFAULT_SHORTCUTS, onAction));
    fireEvent.keyDown(window, { code: 'Digit1', key: '&' });
    fireEvent.keyDown(window, { code: 'ArrowRight', key: 'ArrowRight' });
    expect(onAction).toHaveBeenNthCalledWith(1, { type: 'setMode', mode: 'full' });
    expect(onAction).toHaveBeenNthCalledWith(2, { type: 'next' });
    unmount();
    fireEvent.keyDown(window, { code: 'ArrowRight', key: 'ArrowRight' });
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it('ignore la frappe dans un champ, les combinaisons et la répétition', () => {
    const onAction = vi.fn();
    const { unmount } = renderHook(() => useShortcuts(DEFAULT_SHORTCUTS, onAction));
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { code: 'Digit1', key: '1' });
    fireEvent.keyDown(window, { code: 'ArrowRight', key: 'ArrowRight', ctrlKey: true });
    fireEvent.keyDown(window, { code: 'ArrowRight', key: 'ArrowRight', repeat: true });
    expect(onAction).not.toHaveBeenCalled();
    input.remove();
    unmount();
  });

  it('se coupe quand enabled vaut false', () => {
    const onAction = vi.fn();
    const { rerender, unmount } = renderHook(({ on }) => useShortcuts(DEFAULT_SHORTCUTS, onAction, on), {
      initialProps: { on: false },
    });
    fireEvent.keyDown(window, { code: 'ArrowRight', key: 'ArrowRight' });
    expect(onAction).not.toHaveBeenCalled();
    rerender({ on: true });
    fireEvent.keyDown(window, { code: 'ArrowRight', key: 'ArrowRight' });
    expect(onAction).toHaveBeenCalledTimes(1);
    unmount();
  });
});
