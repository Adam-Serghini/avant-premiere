// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EmissionFilm, Film } from '../../shared/types';
import { FullView } from './FullView';

const film = {
  id: 'manual:1', source: 'manual', title: 'Le Corset', originalTitle: null, releaseDateFr: '2026-10-15',
  posterUrl: 'https://tmdb/a.jpg', customPosterUrl: '/media/b.jpg', localTrailerUrl: null,
  directors: ['Louis Clichy'], cast: ['Gary Clichy', 'Rod Paradot'], genres: ['Animation'], runtimeMin: 81,
  synopsis: 'Un résumé.', trailers: [], fetchedAt: null, editedFields: [], imdbId: null, ratings: null,
} as Film;
const ef = { film, position: 1, section: 'releases', opinion: 'privé', anecdotes: '', extendedUniverse: '', score: 9, trailerKey: null } as EmissionFilm;

describe('la Fiche à l’antenne', () => {
  it('montre le film, le compteur et l’affiche choisie, sans nom ni logo ni notes', () => {
    const { container } = render(<FullView airDate="2026-10-27" ef={ef} position={1} total={4} />);
    expect(screen.getByRole('heading', { name: 'Le Corset' })).toBeTruthy();
    expect(screen.getByText('Film 2 / 4')).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/media/b.jpg');
    expect(container.textContent).not.toMatch(/Avant-Première/);
    expect(container.textContent).not.toMatch(/privé|9\/10/);
    expect(screen.getByText(/Animation · 2026 · 1 h 21/)).toBeTruthy();
  });

  it('affiche les notes quand il y en a, et rien sinon', () => {
    const rated = { ...ef, film: { ...film, ratings: { imdb: 7.4, rottenTomatoes: 85, metacritic: null } } } as EmissionFilm;
    const { container, rerender } = render(<FullView airDate="2026-10-27" ef={rated} position={1} total={4} />);
    expect(container.querySelector('.ov-ratings')?.textContent).toBe('IMDb 7,4 · Rotten Tomatoes 85 %');
    rerender(<FullView airDate="2026-10-27" ef={ef} position={1} total={4} />);
    expect(container.querySelector('.ov-ratings')).toBeNull();
  });
});
