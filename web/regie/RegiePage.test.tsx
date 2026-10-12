// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegiePage } from './RegiePage';
import { api } from '../api';
import { useLiveSnapshot } from '../live/useLiveSnapshot';

vi.mock('../api', () => ({
  api: { live: vi.fn(), today: vi.fn(), liveAction: vi.fn() },
  errorMessage: (e: unknown) => String(e),
}));
vi.mock('../live/useLiveSnapshot', () => ({ useLiveSnapshot: vi.fn() }));
vi.mock('./OverlayPreview', () => ({ OverlayPreview: () => null }));

const snap = (airDate: string | null, total: number) => ({
  state: { airDate, position: 0, mode: 'off' },
  total,
  rundown: [],
  current: null,
  overlayConnected: false,
});

describe('RegiePage au chargement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLiveSnapshot).mockReturnValue({ snapshot: null, connected: true } as never);
    vi.mocked(api.liveAction).mockResolvedValue(snap(null, 0) as never);
    window.history.replaceState(null, '', '/regie');
  });
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('reprend le live en cours sans envoyer start', async () => {
    vi.mocked(api.live).mockResolvedValue(snap('2026-10-13', 2) as never);
    render(<RegiePage />);
    await waitFor(() => expect(window.location.search).toBe('?date=2026-10-13'));
    expect(window.location.pathname).toBe('/regie');
    expect(api.liveAction).not.toHaveBeenCalled();
    expect(api.today).not.toHaveBeenCalled();
  });

  it('sans live en cours, utilise la date du jour et envoie start', async () => {
    vi.mocked(api.live).mockResolvedValue(snap(null, 0) as never);
    vi.mocked(api.today).mockResolvedValue({ airDate: '2026-10-13' });
    render(<RegiePage />);
    await waitFor(() => expect(api.liveAction).toHaveBeenCalledWith({ type: 'start', airDate: '2026-10-13' }));
    expect(window.location.search).toBe('?date=2026-10-13');
  });

  it('avec ?date= explicite, envoie start pour cette date', async () => {
    window.history.replaceState(null, '', '/regie?date=2026-10-20');
    render(<RegiePage />);
    await waitFor(() => expect(api.liveAction).toHaveBeenCalledWith({ type: 'start', airDate: '2026-10-20' }));
    expect(api.live).not.toHaveBeenCalled();
  });
});
