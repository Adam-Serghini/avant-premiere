import { describe, expect, it } from 'vitest';
import type { EmissionFilm, Film, Trailer } from './types';
import { defaultTrailerKey, effectiveTrailer, selectTrailers, trailerLabel, trailerLabels } from './trailer';

const fr: Trailer = { key: 'fr1', name: 'Bande-annonce VF', lang: 'fr', type: 'Trailer' };
const vost: Trailer = { key: 'vost1', name: 'Bande-annonce VOST', lang: 'fr', type: 'Trailer' };
const en: Trailer = { key: 'en1', name: 'Official Trailer', lang: 'en', type: 'Trailer' };
const teaser: Trailer = { key: 'tz1', name: 'Teaser', lang: 'fr', type: 'Teaser' };

function ef(trailers: Trailer[], trailerKey: string | null, localTrailerUrl: string | null = null): EmissionFilm {
  const film = { trailers, localTrailerUrl } as Film;
  return { film, position: 0, period: 'next', opinion: '', anecdotes: '', extendedUniverse: '', score: null, trailerKey };
}

describe('bandes-annonces', () => {
  it('ne garde que la VF et la VOST quand il y en a, jamais les teasers', () => {
    const enTeaser: Trailer = { key: 'tz2', name: 'Teaser', lang: 'en', type: 'Teaser' };
    expect(selectTrailers([en, fr, teaser, vost, enTeaser])).toEqual([fr, vost]);
  });

  it('reconnaît une VOST à son nom, même mal étiquetée', () => {
    const vostEn: Trailer = { key: 'vost2', name: 'Bande-annonce VOSTFR', lang: 'en', type: 'Trailer' };
    expect(selectTrailers([en, vostEn])).toEqual([vostEn]);
  });

  it('garde la VO en secours, sauf les teasers', () => {
    const enTeaser: Trailer = { key: 'tz2', name: 'Teaser', lang: 'en', type: 'Teaser' };
    expect(selectTrailers([en, enTeaser])).toEqual([en]);
    expect(selectTrailers([teaser, enTeaser])).toEqual([]);
    expect(selectTrailers([])).toEqual([]);
  });

  it('choisit la première VF par défaut, sinon la première disponible', () => {
    expect(defaultTrailerKey([en, fr])).toBe('fr1');
    expect(defaultTrailerKey([en])).toBe('en1');
    expect(defaultTrailerKey([])).toBeNull();
  });

  it('suit le choix enregistré, puis la vidéo locale, puis la VF', () => {
    expect(effectiveTrailer(ef([fr, en], 'en1'))).toEqual({ kind: 'youtube', key: 'en1' });
    expect(effectiveTrailer(ef([fr, en], 'disparue'))).toEqual({ kind: 'youtube', key: 'fr1' });
    expect(effectiveTrailer(ef([], null))).toBeNull();
    expect(effectiveTrailer(ef([fr], 'local', '/media/v.mp4'))).toEqual({ kind: 'local', url: '/media/v.mp4' });
    expect(effectiveTrailer(ef([fr], 'fr1', '/media/v.mp4'))).toEqual({ kind: 'youtube', key: 'fr1' });
    expect(effectiveTrailer(ef([fr], null, '/media/v.mp4'))).toEqual({ kind: 'local', url: '/media/v.mp4' });
    expect(effectiveTrailer(ef([fr], 'local', null))).toEqual({ kind: 'youtube', key: 'fr1' });
  });

  it('donne un libellé court', () => {
    expect(trailerLabel(fr)).toBe('VF');
    expect(trailerLabel(vost)).toBe('VOST');
    expect(trailerLabel(en)).toBe('VO');
    expect(trailerLabel(teaser)).toBe('Teaser');
  });

  it('numérote les libellés en double', () => {
    expect(trailerLabels([fr, en, { ...fr, key: 'fr2' }])).toEqual(['VF', 'VO', 'VF 2']);
  });
});
