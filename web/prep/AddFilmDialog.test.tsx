// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { AddFilmDialog } from './AddFilmDialog';

vi.mock('../api', () => ({ api: { search: vi.fn() }, errorMessage: String }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

describe('ajout d’un film', () => {
  afterEach(cleanup);

  it('propose les 4 parties, le coin docu coché par défaut', () => {
    render(<AddFilmDialog open onClose={vi.fn()} onAdd={vi.fn()} />);
    const group = screen.getByRole('group', { name: 'Partie' });
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((r) => r.parentElement?.textContent)).toEqual([
      'Film vu cette semaine', 'Le coin docu', 'Sortie de la semaine', 'Le classique',
    ]);
    expect(radios.map((r) => r.checked)).toEqual([false, true, false, false]);
  });

  it('envoie la partie choisie à l’ajout', async () => {
    vi.mocked(api.search).mockResolvedValue([{ id: 'tmdb:9', title: 'Vertigo', year: 1958, posterUrl: null } as never]);
    const onAdd = vi.fn().mockResolvedValue(null);
    render(<AddFilmDialog open onClose={vi.fn()} onAdd={onAdd} />);
    fireEvent.click(screen.getByLabelText('Le classique'));
    fireEvent.change(screen.getByLabelText('Chercher sur TMDB'), { target: { value: 'Vertigo' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter' }, { timeout: 2000 }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('tmdb:9', 'classic'));
  });

  it('propose de créer la fiche à la main quand TMDB ne trouve rien', async () => {
    vi.mocked(api.search).mockResolvedValue([]);
    render(<AddFilmDialog open onClose={vi.fn()} onAdd={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Chercher sur TMDB'), { target: { value: 'NASA' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Créer la fiche « NASA » à la main' }, { timeout: 2000 }));
    expect((screen.getByLabelText('Titre *') as HTMLInputElement).value).toBe('NASA');
  });
});
