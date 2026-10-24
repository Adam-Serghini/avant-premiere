import type { TmdbDetails } from './mapping';

export const detailsFixture: TmdbDetails = {
  id: 1001,
  imdb_id: 'tt1234567',
  title: 'La Nuit du projectionniste',
  original_title: 'The Projectionist Night',
  poster_path: '/abc.jpg',
  overview: '  Un projectionniste veille sur la dernière bobine.  ',
  runtime: 105,
  release_date: '2026-09-30',
  genres: [{ name: 'Drame' }, { name: 'Thriller' }],
  credits: {
    cast: [
      { name: 'Actrice C', order: 2 },
      { name: 'Acteur A', order: 0 },
      { name: 'Actrice B', order: 1 },
      { name: 'Acteur D', order: 3 },
      { name: 'Actrice E', order: 4 },
      { name: 'Acteur F', order: 5 },
    ],
    crew: [
      { name: 'Réalisatrice X', job: 'Director' },
      { name: 'Réalisatrice X', job: 'Director' },
      { name: 'Producteur Y', job: 'Producer' },
    ],
  },
  videos: {
    results: [
      { key: 'enTrailer01', name: 'Official Trailer', site: 'YouTube', type: 'Trailer', iso_639_1: 'en' },
      { key: 'frTeaser001', name: 'Teaser VF', site: 'YouTube', type: 'Teaser', iso_639_1: 'fr' },
      { key: 'frTrailer01', name: 'Bande-annonce VF', site: 'YouTube', type: 'Trailer', iso_639_1: 'fr' },
      { key: 'vimeo', name: 'Sur Vimeo', site: 'Vimeo', type: 'Trailer', iso_639_1: 'fr' },
      { key: 'clip', name: 'Extrait', site: 'YouTube', type: 'Clip', iso_639_1: 'fr' },
    ],
  },
  release_dates: {
    results: [
      { iso_3166_1: 'US', release_dates: [{ release_date: '2026-09-30T00:00:00.000Z', type: 3 }] },
      {
        iso_3166_1: 'FR',
        release_dates: [
          { release_date: '2026-10-14T00:00:00.000Z', type: 3 },
          { release_date: '2026-06-01T00:00:00.000Z', type: 1 },
        ],
      },
    ],
  },
};

export const minimalDetailsFixture: TmdbDetails = {
  id: 1002,
  title: 'Sans rien',
  poster_path: null,
};
