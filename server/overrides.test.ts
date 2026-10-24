import { describe, expect, it } from 'vitest';
import type { Film } from '../shared/types';
import { diffOverrides } from './overrides';

const base: Film = {
  id: 'tmdb:1',
  source: 'tmdb',
  title: 'Film',
  originalTitle: null,
  releaseDateFr: '2026-10-14',
  posterUrl: null,
  customPosterUrl: null,
  localTrailerUrl: null,
  directors: ['Réalisatrice X'],
  cast: ['Acteur A'],
  genres: ['Drame'],
  runtimeMin: 100,
  synopsis: 'Résumé',
  trailers: [{ key: 'abc', name: 'Trailer', lang: 'en', type: 'Trailer' }],
  fetchedAt: null,
  editedFields: [],
  imdbId: null,
  ratings: null,
};

const extra = { key: 'zzz', name: 'Bande-annonce ajoutée', lang: 'fr', type: 'Trailer' } as const;

describe('diffOverrides', () => {
  it('ne garde que les champs modifiés', () => {
    expect(diffOverrides(base, { title: 'Autre', cast: ['Acteur A'], runtimeMin: 100 })).toEqual({ title: 'Autre' });
  });

  it('compare les listes en profondeur', () => {
    expect(diffOverrides(base, { cast: ['Иван'] })).toEqual({ cast: ['Иван'] });
    expect(diffOverrides(base, { directors: ['Réalisatrice X'] })).toEqual({});
  });

  it('abandonne une valeur revenue à celle de TMDB', () => {
    expect(diffOverrides(base, { synopsis: 'Résumé', releaseDateFr: '2026-10-14' })).toEqual({});
  });

  it('garde une valeur vidée', () => {
    expect(diffOverrides(base, { synopsis: null, runtimeMin: null })).toEqual({ synopsis: null, runtimeMin: null });
  });

  it('garde une bande-annonce ajoutée, sauf si TMDB l’a déjà', () => {
    expect(diffOverrides(base, { extraTrailer: extra })).toEqual({ extraTrailer: extra });
    expect(diffOverrides(base, { extraTrailer: { ...extra, key: 'abc' } })).toEqual({});
    expect(diffOverrides(base, { extraTrailer: undefined })).toEqual({});
  });
});
