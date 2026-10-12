// @vitest-environment jsdom
import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { keyToAction, useShortcuts } from './shortcuts';

describe('raccourcis de la régie', () => {
  it('associe chaque touche à une action', () => {
    expect(keyToAction('ArrowRight')).toEqual({ type: 'next' });
    expect(keyToAction('ArrowLeft')).toEqual({ type: 'prev' });
    expect(keyToAction('1')).toEqual({ type: 'setMode', mode: 'card' });
    expect(keyToAction('2')).toEqual({ type: 'setMode', mode: 'full' });
    expect(keyToAction('3')).toEqual({ type: 'setMode', mode: 'trailer' });
    expect(keyToAction('4')).toEqual({ type: 'setMode', mode: 'off' });
    expect(keyToAction('x')).toBeNull();
  });

  it('déclenche l’action sur la fenêtre', () => {
    const onAction = vi.fn();
    const { unmount } = renderHook(() => useShortcuts(onAction));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: '3' });
    expect(onAction).toHaveBeenNthCalledWith(1, { type: 'next' });
    expect(onAction).toHaveBeenNthCalledWith(2, { type: 'setMode', mode: 'trailer' });
    unmount();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it('ignore la frappe dans un champ et les combinaisons avec Ctrl', () => {
    const onAction = vi.fn();
    const { unmount } = renderHook(() => useShortcuts(onAction));
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: '1' });
    fireEvent.keyDown(window, { key: 'ArrowRight', ctrlKey: true });
    expect(onAction).not.toHaveBeenCalled();
    input.remove();
    unmount();
  });

  it('ignore la répétition automatique d’une touche maintenue', () => {
    const onAction = vi.fn();
    const { unmount } = renderHook(() => useShortcuts(onAction));
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });
    expect(onAction).not.toHaveBeenCalled();
    unmount();
  });
});
