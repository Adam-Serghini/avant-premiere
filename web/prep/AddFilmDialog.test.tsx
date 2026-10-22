// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { AddFilmDialog } from './AddFilmDialog';

vi.mock('../api', () => ({ api: { search: vi.fn() }, errorMessage: String }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

describe('ajout d’un film', () => {
  it('propose de créer la fiche à la main quand TMDB ne trouve rien', async () => {
    vi.mocked(api.search).mockResolvedValue([]);
    render(<AddFilmDialog open onClose={vi.fn()} onAdd={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Chercher sur TMDB'), { target: { value: 'NASA' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Créer la fiche « NASA » à la main' }, { timeout: 2000 }));
    expect((screen.getByLabelText('Titre *') as HTMLInputElement).value).toBe('NASA');
  });
});
