// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveSnapshot } from './useLiveSnapshot';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static CLOSED = 2;
  readyState = 1;
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
}

describe('useLiveSnapshot', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', FakeEventSource);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const snap = { marker: 1 };

  it('met à jour le snapshot à chaque message', () => {
    const { result } = renderHook(() => useLiveSnapshot('overlay'));
    expect(FakeEventSource.instances[0].url).toBe('/api/live/stream?client=overlay');
    act(() => FakeEventSource.instances[0].onmessage?.({ data: JSON.stringify(snap) }));
    expect(result.current.snapshot).toEqual(snap);
    expect(result.current.connected).toBe(true);
  });

  it('ignore une trame illisible', () => {
    const { result } = renderHook(() => useLiveSnapshot('other'));
    act(() => FakeEventSource.instances[0].onmessage?.({ data: JSON.stringify(snap) }));
    act(() => FakeEventSource.instances[0].onmessage?.({ data: '{pas du json' }));
    expect(result.current.snapshot).toEqual(snap);
  });

  it('se reconnecte après 2 s quand la connexion est fermée, en gardant le dernier état', async () => {
    const { result } = renderHook(() => useLiveSnapshot('overlay'));
    act(() => FakeEventSource.instances[0].onmessage?.({ data: JSON.stringify(snap) }));
    act(() => {
      FakeEventSource.instances[0].readyState = 2;
      FakeEventSource.instances[0].onerror?.();
    });
    expect(result.current.connected).toBe(false);
    expect(result.current.snapshot).toEqual(snap);
    expect(FakeEventSource.instances).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('ferme la connexion au démontage et ne se reconnecte plus', async () => {
    const { unmount } = renderHook(() => useLiveSnapshot('overlay'));
    const first = FakeEventSource.instances[0];
    act(() => {
      first.readyState = 2;
      first.onerror?.();
    });
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(first.closed).toBe(true);
  });

  it('ferme la source ouverte au démontage', () => {
    const { unmount } = renderHook(() => useLiveSnapshot('overlay'));
    unmount();
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });
});
