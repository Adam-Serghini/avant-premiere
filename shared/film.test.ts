import { describe, expect, it } from 'vitest';
import type { Film } from './types';
import { displayPoster } from './film';

describe('affiche affichée', () => {
  it('préfère l’affiche choisie à celle de TMDB', () => {
    expect(displayPoster({ posterUrl: 'https://tmdb/a.jpg', customPosterUrl: null } as Film)).toBe('https://tmdb/a.jpg');
    expect(displayPoster({ posterUrl: 'https://tmdb/a.jpg', customPosterUrl: '/media/b.jpg' } as Film)).toBe('/media/b.jpg');
    expect(displayPoster({ posterUrl: null, customPosterUrl: null } as Film)).toBeNull();
  });
});
