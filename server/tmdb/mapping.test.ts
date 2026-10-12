import { describe, expect, it } from 'vitest';
import { detailsFixture, minimalDetailsFixture } from './fixtures';
import { toFilm, toReleaseSummary } from './mapping';

const NOW = '2026-10-07T10:00:00.000Z';

describe('conversion TMDB', () => {
  it('convertit un résultat de liste', () => {
    expect(toReleaseSummary({ id: 7, title: 'Titre', poster_path: '/p.jpg', release_date: '1967-10-25' })).toEqual({
      id: 'tmdb:7',
      title: 'Titre',
      posterUrl: 'https://image.tmdb.org/t/p/w342/p.jpg',
      year: '1967',
    });
    expect(toReleaseSummary({ id: 8, title: 'Sans affiche', poster_path: null, release_date: '' })).toEqual({
      id: 'tmdb:8',
      title: 'Sans affiche',
      posterUrl: null,
      year: null,
    });
  });

  it('convertit une fiche complète', () => {
    expect(toFilm(detailsFixture, NOW)).toEqual({
      id: 'tmdb:1001',
      source: 'tmdb',
      title: 'La Nuit du projectionniste',
      originalTitle: 'The Projectionist Night',
      releaseDateFr: '2026-10-14',
      posterUrl: 'https://image.tmdb.org/t/p/w780/abc.jpg',
      directors: ['Réalisatrice X'],
      cast: ['Acteur A', 'Actrice B', 'Actrice C', 'Acteur D', 'Actrice E'],
      genres: ['Drame', 'Thriller'],
      runtimeMin: 105,
      synopsis: 'Un projectionniste veille sur la dernière bobine.',
      trailers: [
        { key: 'frTrailer01', name: 'Bande-annonce VF', lang: 'fr', type: 'Trailer' },
        { key: 'frTeaser001', name: 'Teaser VF', lang: 'fr', type: 'Teaser' },
        { key: 'enTrailer01', name: 'Official Trailer', lang: 'en', type: 'Trailer' },
      ],
      fetchedAt: NOW,
    });
  });

  it('supporte une fiche presque vide', () => {
    expect(toFilm(minimalDetailsFixture, NOW)).toEqual({
      id: 'tmdb:1002',
      source: 'tmdb',
      title: 'Sans rien',
      originalTitle: null,
      releaseDateFr: null,
      posterUrl: null,
      directors: [],
      cast: [],
      genres: [],
      runtimeMin: null,
      synopsis: null,
      trailers: [],
      fetchedAt: NOW,
    });
  });

  it('n’indique pas le titre original s’il est identique', () => {
    expect(toFilm({ ...minimalDetailsFixture, original_title: 'Sans rien' }, NOW).originalTitle).toBeNull();
  });
});
