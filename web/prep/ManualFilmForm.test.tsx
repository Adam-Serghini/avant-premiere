// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Film } from '../../shared/types';
import { api } from '../api';
import { ManualFilmForm } from './ManualFilmForm';

vi.mock('../api', () => ({
  api: { createManual: vi.fn(), updateManual: vi.fn(), uploadPoster: vi.fn(), uploadTrailer: vi.fn() },
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

const film = { id: 'manual:1', source: 'manual', title: 'NASA', directors: [], cast: [], genres: ['Documentaire'], trailers: [],
  releaseDateFr: null, posterUrl: null, runtimeMin: 92, synopsis: 'Résumé', customPosterUrl: null, localTrailerUrl: null } as unknown as Film;

const props = { submitLabel: 'Créer et ajouter', cancelLabel: 'Retour', onCancel: vi.fn() };

describe('formulaire de fiche', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('crée la fiche avec genres, durée et résumé, puis envoie l’affiche', async () => {
    vi.mocked(api.createManual).mockResolvedValue(film);
    vi.mocked(api.uploadPoster).mockResolvedValue({ ...film, customPosterUrl: '/media/a.png' });
    const onSaved = vi.fn();
    render(<ManualFilmForm {...props} initialTitle="NASA" onSaved={onSaved} />);
    expect((screen.getByLabelText('Titre *') as HTMLInputElement).value).toBe('NASA');
    fireEvent.change(screen.getByLabelText(/Genres/), { target: { value: 'Documentaire, Histoire' } });
    fireEvent.change(screen.getByLabelText(/Durée/), { target: { value: '92' } });
    fireEvent.change(screen.getByLabelText('Résumé'), { target: { value: 'Une histoire.' } });
    const poster = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/Ou une image de l’ordinateur/), { target: { files: [poster] } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer et ajouter' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...film, customPosterUrl: '/media/a.png' }));
    expect(api.createManual).toHaveBeenCalledWith({
      title: 'NASA',
      genres: ['Documentaire', 'Histoire'],
      runtimeMin: 92,
      synopsis: 'Une histoire.',
    });
    expect(api.uploadPoster).toHaveBeenCalledWith('manual:1', poster);
  });

  it('ne recrée pas la fiche si l’envoi du fichier a échoué', async () => {
    vi.mocked(api.createManual).mockResolvedValue(film);
    vi.mocked(api.updateManual).mockResolvedValue(film);
    vi.mocked(api.uploadTrailer).mockRejectedValueOnce(new Error('Fichier trop lourd (1 Go maximum).'));
    render(<ManualFilmForm {...props} initialTitle="NASA" onSaved={vi.fn()} />);
    const video = new File(['x'], 'v.mp4', { type: 'video/mp4' });
    fireEvent.change(screen.getByLabelText(/Ou une vidéo de l’ordinateur/), { target: { files: [video] } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer et ajouter' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/trop lourd/);
    fireEvent.click(screen.getByRole('button', { name: 'Créer et ajouter' }));
    await waitFor(() => expect(api.updateManual).toHaveBeenCalledWith('manual:1', expect.objectContaining({ title: 'NASA' })));
    expect(api.createManual).toHaveBeenCalledTimes(1);
  });

  it('préremplit et modifie une fiche existante', async () => {
    vi.mocked(api.updateManual).mockResolvedValue(film);
    const onSaved = vi.fn();
    render(<ManualFilmForm {...props} submitLabel="Enregistrer" initial={film} onSaved={onSaved} />);
    expect((screen.getByLabelText(/Genres/) as HTMLInputElement).value).toBe('Documentaire');
    expect((screen.getByLabelText('Résumé') as HTMLTextAreaElement).value).toBe('Résumé');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api.updateManual).toHaveBeenCalledWith('manual:1', expect.objectContaining({ title: 'NASA', runtimeMin: 92 }));
    expect(api.createManual).not.toHaveBeenCalled();
  });
});
