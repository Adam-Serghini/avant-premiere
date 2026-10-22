// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { TrailerView } from './TrailerView';

vi.mock('../api', () => ({ api: { liveAction: vi.fn() } }));

describe('bande-annonce locale', () => {
  beforeEach(() => {
    vi.mocked(api.liveAction).mockResolvedValue({} as never);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('joue le fichier avec le son et signale la fin une seule fois', async () => {
    const { container } = render(<TrailerView trailer={{ kind: 'local', url: '/media/v.mp4' }} preview={false} />);
    const video = container.querySelector('video')!;
    expect(video.getAttribute('src')).toBe('/media/v.mp4');
    expect(video.muted).toBe(false);
    fireEvent.ended(video);
    fireEvent.ended(video);
    await vi.waitFor(() => expect(api.liveAction).toHaveBeenCalledTimes(1));
    expect(api.liveAction).toHaveBeenCalledWith({ type: 'trailerEnded' });
  });

  it('signale la fin si la lecture échoue ou ne démarre pas en 15 s', async () => {
    vi.useFakeTimers();
    render(<TrailerView trailer={{ kind: 'local', url: '/media/v.mp4' }} preview={false} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(api.liveAction).toHaveBeenCalledWith({ type: 'trailerEnded' });
  });

  it('reste muette et silencieuse en aperçu', () => {
    const { container } = render(<TrailerView trailer={{ kind: 'local', url: '/media/v.mp4' }} preview />);
    const video = container.querySelector('video')!;
    expect(video.muted).toBe(true);
    fireEvent.ended(video);
    expect(api.liveAction).not.toHaveBeenCalled();
  });
});
