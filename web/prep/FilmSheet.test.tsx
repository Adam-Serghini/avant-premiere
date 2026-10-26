// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmissionFilm, Film } from '../../shared/types';
import { api } from '../api';
import { FilmSheet } from './FilmSheet';

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  api: { resetFilm: vi.fn(), patchFilm: vi.fn() },
}));

function sheet(film: Partial<Film>, handlers: { onFilmChanged?(): void; onError?(e: unknown): void } = {}) {
  const base = {
    id: 'tmdb:1', source: 'tmdb', title: 'Film', originalTitle: null, releaseDateFr: null, posterUrl: null,
    customPosterUrl: null, localTrailerUrl: null, directors: [], cast: [], genres: [], runtimeMin: null,
    synopsis: null, trailers: [], fetchedAt: null, editedFields: [], imdbId: null, ratings: null,
  } as Film;
  const ef = { film: { ...base, ...film }, position: 0, section: 'seen', opinion: '', anecdotes: '', extendedUniverse: '',
    score: null, trailerKey: null } as EmissionFilm;
  return render(<FilmSheet airDate="2026-10-13" ef={ef} onSaved={vi.fn()} onRemove={vi.fn()} onRefresh={vi.fn()}
    onFilmChanged={handlers.onFilmChanged ?? vi.fn()} onError={handlers.onError ?? vi.fn()} />);
}

describe('fiche de la régie', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('permet de modifier une fiche TMDB comme une fiche manuelle', () => {
    sheet({ source: 'tmdb' });
    expect(screen.getByRole('button', { name: 'Modifier la fiche' })).toBeTruthy();
    cleanup();
    sheet({ source: 'manual', id: 'manual:1' });
    expect(screen.getByRole('button', { name: 'Modifier la fiche' })).toBeTruthy();
  });

  it('ne propose de revenir à TMDB que si la fiche a été corrigée', () => {
    sheet({ editedFields: [] });
    expect(screen.queryByRole('button', { name: 'Revenir aux infos TMDB' })).toBeNull();
    expect(screen.queryByText('Fiche corrigée par toi')).toBeNull();
    cleanup();
    sheet({ editedFields: ['cast'] });
    expect(screen.getByText('Fiche corrigée par toi')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revenir aux infos TMDB' })).toBeTruthy();
  });

  it('efface les corrections après confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.resetFilm).mockResolvedValue({} as Film);
    const onFilmChanged = vi.fn();
    sheet({ editedFields: ['cast'] }, { onFilmChanged });
    fireEvent.click(screen.getByRole('button', { name: 'Revenir aux infos TMDB' }));
    expect(confirm).toHaveBeenCalledWith('Effacer tes corrections et revenir aux infos de TMDB ?');
    await waitFor(() => expect(onFilmChanged).toHaveBeenCalled());
    expect(api.resetFilm).toHaveBeenCalledWith('tmdb:1');
  });

  it('ne fait rien si la confirmation est refusée', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    sheet({ editedFields: ['cast'] });
    fireEvent.click(screen.getByRole('button', { name: 'Revenir aux infos TMDB' }));
    expect(api.resetFilm).not.toHaveBeenCalled();
  });

  it('signale l’échec', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const err = new Error('boum');
    vi.mocked(api.resetFilm).mockRejectedValue(err);
    const onError = vi.fn();
    sheet({ editedFields: ['title'] }, { onError });
    fireEvent.click(screen.getByRole('button', { name: 'Revenir aux infos TMDB' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith(err));
  });
});
