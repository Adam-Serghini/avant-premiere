// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EmissionFilm } from '../../shared/types';
import { PrivateNotes } from './PrivateNotes';

const base = { opinion: '', anecdotes: '', extendedUniverse: '', score: null } as EmissionFilm;

describe('notes privées en régie', () => {
  it('affiche seulement les sections remplies, dans l’ordre', () => {
    render(<PrivateNotes ef={{ ...base, opinion: 'Grosse production', extendedUniverse: 'Film de 1958', score: 7 }} />);
    const titles = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(titles).toEqual(['Mon avis', 'Univers étendu']);
    expect(screen.getByText('Grosse production')).toBeTruthy();
    expect(screen.getByText(/7\/10/)).toBeTruthy();
  });

  it('indique l’absence de notes', () => {
    render(<PrivateNotes ef={base} />);
    expect(screen.getByText('Aucune note pour ce film.')).toBeTruthy();
  });
});
