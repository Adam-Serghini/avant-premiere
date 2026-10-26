// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHORTCUTS } from '../../shared/shortcuts';
import { RegiePage } from './RegiePage';
import { api } from '../api';
import { useLiveSnapshot } from '../live/useLiveSnapshot';

vi.mock('../api', () => ({
  api: { live: vi.fn(), today: vi.fn(), liveAction: vi.fn(), shortcuts: vi.fn(), saveShortcuts: vi.fn() },
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
  player: { paused: false, volume: 100, seek: null },
});

describe('RegiePage au chargement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLiveSnapshot).mockReturnValue({ snapshot: null, connected: true } as never);
    vi.mocked(api.liveAction).mockResolvedValue(snap(null, 0) as never);
    vi.mocked(api.shortcuts).mockResolvedValue(DEFAULT_SHORTCUTS);
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

  it('prévient quand les raccourcis personnalisés ne se chargent pas', async () => {
    vi.mocked(api.live).mockResolvedValue(snap('2026-10-13', 2) as never);
    vi.mocked(api.shortcuts).mockRejectedValue(new Error('réseau'));
    render(<RegiePage />);
    expect(await screen.findByText(/touches par défaut utilisées/)).toBeTruthy();
  });
});

describe('RegiePage, les parties', () => {
  const film = (id: string, title: string) => ({
    id, source: 'manual', title, originalTitle: null, releaseDateFr: null, posterUrl: null, customPosterUrl: null,
    localTrailerUrl: null, directors: [], cast: [], genres: [], runtimeMin: null, synopsis: null, trailers: [],
    fetchedAt: null, editedFields: [], imdbId: null, ratings: null,
  });
  const live = {
    state: { airDate: '2026-10-27', position: 2, mode: 'off' },
    total: 4,
    rundown: [
      { filmId: 'a', title: 'Alpha', section: 'seen' },
      { filmId: 'b', title: 'Bravo', section: 'docu' },
      { filmId: 'c', title: 'Charlie', section: 'docu' },
      { filmId: 'd', title: 'Delta', section: 'classic' },
    ],
    current: { film: film('c', 'Charlie'), position: 2, section: 'docu', opinion: '', anecdotes: '', extendedUniverse: '', score: null, trailerKey: null },
    overlayConnected: false,
    player: { paused: false, volume: 100, seek: null },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLiveSnapshot).mockReturnValue({ snapshot: live, connected: true } as never);
    vi.mocked(api.live).mockResolvedValue(live as never);
    vi.mocked(api.shortcuts).mockResolvedValue(DEFAULT_SHORTCUTS);
    window.history.replaceState(null, '', '/regie?date=2026-10-27');
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
  });

  it('groupe le conducteur par partie non vide', async () => {
    const { container } = render(<RegiePage />);
    await screen.findByRole('heading', { name: 'Charlie' });
    const titles = [...container.querySelectorAll('.steps-part-title')].map((t) => t.textContent);
    expect(titles).toEqual(['Film vu cette semaine', 'Le coin docu', 'Le classique']);
    expect(screen.queryByText('Sortie de la semaine')).toBeNull();
    expect(container.querySelectorAll('.steps .n')[3].textContent).toBe('4');
  });

  it('indique la partie et le rang du film en cours dans le surtitre', async () => {
    const { container } = render(<RegiePage />);
    await screen.findByRole('heading', { name: 'Charlie' });
    const kicker = container.querySelector('.on-air .kicker')?.textContent ?? '';
    expect(kicker).toBe('Le coin docu · 2 / 2 · Film 3 sur 4');
  });

  const withPlayer = (mode: string, player: object) => ({ ...live, state: { ...live.state, mode }, player });
  const names = ['Pause', '−5 s', '+5 s', 'Au début'];

  it('affiche six commandes de bande-annonce avec leur touche', () => {
    const { container } = render(<RegiePage />);
    const box = container.querySelector('.player-controls') as HTMLElement;
    expect([...box.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Pause Espace', '−5 s J', '+5 s L', 'Au début 0', 'Son − ↓', 'Son + ↑',
    ]);
  });

  it('propose Lecture quand la bande-annonce est en pause, et affiche l’état', () => {
    vi.mocked(useLiveSnapshot).mockReturnValue({
      snapshot: withPlayer('trailer', { paused: true, volume: 70, seek: null }), connected: true,
    } as never);
    render(<RegiePage />);
    expect(screen.getByRole('button', { name: /^Lecture/ })).toBeTruthy();
    expect(screen.getByText('En pause · Son 70 %')).toBeTruthy();
  });

  it('affiche En lecture', () => {
    vi.mocked(useLiveSnapshot).mockReturnValue({
      snapshot: withPlayer('trailer', { paused: false, volume: 70, seek: null }), connected: true,
    } as never);
    render(<RegiePage />);
    expect(screen.getByText('En lecture · Son 70 %')).toBeTruthy();
  });

  it('hors bande-annonce, n’affiche que le son, même après une pause', () => {
    for (const mode of ['full', 'off']) {
      vi.mocked(useLiveSnapshot).mockReturnValue({
        snapshot: withPlayer(mode, { paused: true, volume: 70, seek: null }), connected: true,
      } as never);
      const { unmount } = render(<RegiePage />);
      expect(screen.getByText('Son 70 %')).toBeTruthy();
      expect(screen.queryByText(/En pause|En lecture/)).toBeNull();
      unmount();
    }
  });

  it('en mode fiche, désactive pause et sauts mais pas le son', () => {
    render(<RegiePage />);
    for (const n of names) expect((screen.getByRole('button', { name: (t) => t.startsWith(n) }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /^Son −/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: /^Son \+/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('en mode bande-annonce, +5 s envoie la commande', () => {
    vi.mocked(useLiveSnapshot).mockReturnValue({
      snapshot: withPlayer('trailer', { paused: false, volume: 100, seek: null }), connected: true,
    } as never);
    vi.mocked(api.liveAction).mockResolvedValue(live as never);
    render(<RegiePage />);
    fireEvent.click(screen.getByRole('button', { name: /^\+5 s/ }));
    expect(api.liveAction).toHaveBeenCalledWith({ type: 'player', command: 'forward' });
  });
});
