// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Emission, EmissionFilm, Film } from '../../shared/types';
import { api } from '../api';
import { PosterControl, VideoControl } from './MediaControls';

vi.mock('../api', () => ({
  api: { uploadPoster: vi.fn(), removePoster: vi.fn(), uploadTrailer: vi.fn(), removeTrailer: vi.fn(), patchFilm: vi.fn() },
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

const film = { id: 'tmdb:1', source: 'tmdb', title: 'Film', customPosterUrl: null, localTrailerUrl: null } as Film;
const ef = { film } as EmissionFilm;

describe('fichiers de l’ordinateur', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('envoie une vidéo et la sélectionne comme bande-annonce', async () => {
    const emission = { films: [] } as unknown as Emission;
    vi.mocked(api.uploadTrailer).mockResolvedValue({ ...film, localTrailerUrl: '/media/v.mp4' });
    vi.mocked(api.patchFilm).mockResolvedValue(emission);
    const onSaved = vi.fn();
    render(<VideoControl airDate="2026-10-13" ef={ef} onSaved={onSaved} onChanged={vi.fn()} />);
    const file = new File(['x'], 'v.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText('Vidéo de l’ordinateur'), { target: { files: [file] } });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(emission));
    expect(api.uploadTrailer).toHaveBeenCalledWith('tmdb:1', file);
    expect(api.patchFilm).toHaveBeenCalledWith('2026-10-13', 'tmdb:1', { trailerKey: 'local' });
  });

  it('affiche l’erreur d’envoi d’une affiche', async () => {
    vi.mocked(api.uploadPoster).mockRejectedValue(new Error('Ce fichier n’est pas une image jpg, png ou webp.'));
    const onChanged = vi.fn();
    render(<PosterControl film={film} onChanged={onChanged} />);
    fireEvent.change(screen.getByLabelText('Utiliser une autre affiche'), {
      target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] },
    });
    expect((await screen.findByRole('alert')).textContent).toMatch(/pas une image/);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('choisit le libellé selon l’origine de la fiche', () => {
    const custom = { customPosterUrl: '/media/a.png' };
    const label = (f: Partial<Film>) => {
      render(<PosterControl film={{ ...film, ...custom, ...f } as Film} onChanged={vi.fn()} />);
      const names = screen.getAllByRole('button').map((b) => b.textContent);
      cleanup();
      return names;
    };
    expect(label({})).toEqual(['Revenir à l’affiche TMDB']);
    expect(label({ source: 'manual', posterUrl: 'https://x.test/a.jpg' })).toEqual(['Revenir à l’affiche du lien']);
    expect(label({ source: 'manual', posterUrl: null })).toEqual(['Retirer l’affiche']);
  });

  it('revient à l’affiche TMDB', async () => {
    vi.mocked(api.removePoster).mockResolvedValue(film);
    const onChanged = vi.fn();
    render(<PosterControl film={{ ...film, customPosterUrl: '/media/a.png' }} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: 'Revenir à l’affiche TMDB' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
