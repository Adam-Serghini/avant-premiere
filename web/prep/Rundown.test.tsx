// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Section } from '../../shared/sections';
import type { EmissionFilm } from '../../shared/types';
import { Rundown } from './Rundown';

function ef(id: string, section: Section): EmissionFilm {
  return { film: { id, title: `Film ${id}` }, position: 0, section, score: null } as EmissionFilm;
}

function rundown(films: EmissionFilm[]) {
  return render(<Rundown films={films} activeId={null} onSelect={vi.fn()} onMove={vi.fn()} />);
}

describe('conducteur par parties', () => {
  afterEach(cleanup);

  it('montre les 4 titres de partie dans l’ordre', () => {
    rundown([ef('a', 'seen'), ef('b', 'classic'), ef('c', 'classic')]);
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Film vu cette semaine', 'Le coin docu', 'Sortie de la semaine', 'Le classique',
    ]);
  });

  it('indique « Aucun film » pour les parties vides', () => {
    rundown([ef('a', 'seen'), ef('b', 'classic'), ef('c', 'classic')]);
    for (const name of ['Le coin docu', 'Sortie de la semaine']) {
      const part = screen.getByRole('region', { name });
      expect(within(part).getByText('Aucun film')).toBeTruthy();
    }
    expect(within(screen.getByRole('region', { name: 'Le classique' })).queryByText('Aucun film')).toBeNull();
  });

  it('garde une numérotation globale', () => {
    rundown([ef('a', 'seen'), ef('b', 'classic'), ef('c', 'classic')]);
    const classic = screen.getByRole('region', { name: 'Le classique' });
    expect(within(screen.getByRole('region', { name: 'Film vu cette semaine' })).getByText('1')).toBeTruthy();
    expect(within(classic).getByText('2')).toBeTruthy();
    expect(within(classic).getByText('3')).toBeTruthy();
  });

  it('désactive Monter sur le premier film de chaque partie et Descendre sur le dernier', () => {
    rundown([ef('a', 'seen'), ef('b', 'classic'), ef('c', 'classic')]);
    const disabled = (name: string) => (screen.getByRole('button', { name }) as HTMLButtonElement).disabled;
    expect(disabled('Monter Film a')).toBe(true);
    expect(disabled('Descendre Film a')).toBe(true);
    expect(disabled('Monter Film b')).toBe(true);
    expect(disabled('Descendre Film b')).toBe(false);
    expect(disabled('Monter Film c')).toBe(false);
    expect(disabled('Descendre Film c')).toBe(true);
  });
});
