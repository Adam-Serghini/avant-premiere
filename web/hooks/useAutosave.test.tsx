// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api';
import { useAutosave } from './useAutosave';

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup(save = vi.fn().mockResolvedValue(undefined)) {
    const hook = renderHook(({ v }) => useAutosave(v, save, 500).status, { initialProps: { v: 'a' } });
    return { ...hook, save };
  }

  it('n’enregistre rien au premier affichage', () => {
    const { result, save } = setup();
    expect(result.current).toBe('idle');
    expect(save).not.toHaveBeenCalled();
  });

  it('regroupe les frappes rapprochées en un seul enregistrement', async () => {
    const { result, rerender, save } = setup();
    rerender({ v: 'ab' });
    rerender({ v: 'abc' });
    expect(result.current).toBe('pending');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('abc');
    expect(result.current).toBe('saved');
  });

  it('enregistre immédiatement au démontage s’il reste une modification', () => {
    const { rerender, unmount, save } = setup();
    rerender({ v: 'ab' });
    unmount();
    expect(save).toHaveBeenCalledWith('ab');
  });

  it('réessaie après un échec', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('réseau')).mockResolvedValue(undefined);
    const { result, rerender } = setup(save);
    rerender({ v: 'ab' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current).toBe('error');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current).toBe('saved');
  });

  it('réessaie après un échec survenu après le démontage', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('réseau')).mockResolvedValue(undefined);
    const { rerender, unmount } = setup(save);
    rerender({ v: 'ab' });
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('ab');
  });

  it('n’envoie jamais deux enregistrements en parallèle', async () => {
    let release!: () => void;
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)))
      .mockResolvedValue(undefined);
    const { rerender } = setup(save);
    rerender({ v: 'ab' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(save).toHaveBeenCalledTimes(1);
    rerender({ v: 'abc' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('abc');
  });

  it('ne réessaie pas après une erreur 4xx et expose le message', async () => {
    const save = vi.fn().mockRejectedValue(new ApiError(400, 'bad', 'Note invalide'));
    const hook = renderHook(({ v }) => useAutosave(v, save, 500), { initialProps: { v: 'a' } });
    hook.rerender({ v: 'ab' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(hook.result.current).toEqual({ status: 'error', errorMessage: 'Note invalide' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });
});
