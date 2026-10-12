import { describe, expect, it } from 'vitest';
import type { EmissionFilm, Film, Trailer } from './types';
import { defaultTrailerKey, effectiveTrailerKey, trailerLabel, trailerLabels } from './trailer';

const fr: Trailer = { key: 'fr1', name: 'Bande-annonce VF', lang: 'fr', type: 'Trailer' };
const vost: Trailer = { key: 'vost1', name: 'Bande-annonce VOST', lang: 'fr', type: 'Trailer' };
const en: Trailer = { key: 'en1', name: 'Official Trailer', lang: 'en', type: 'Trailer' };
const teaser: Trailer = { key: 'tz1', name: 'Teaser', lang: 'fr', type: 'Teaser' };

function ef(trailers: Trailer[], trailerKey: string | null): EmissionFilm {
  const film = { trailers } as Film;
  return { film, position: 0, period: 'next', notes: '', score: null, trailerKey };
}

describe('bandes-annonces', () => {
  it('choisit la première VF par défaut, sinon la première disponible', () => {
    expect(defaultTrailerKey([en, fr])).toBe('fr1');
    expect(defaultTrailerKey([en])).toBe('en1');
    expect(defaultTrailerKey([])).toBeNull();
  });

  it('respecte le choix enregistré s’il existe encore', () => {
    expect(effectiveTrailerKey(ef([fr, en], 'en1'))).toBe('en1');
    expect(effectiveTrailerKey(ef([fr, en], 'disparue'))).toBe('fr1');
    expect(effectiveTrailerKey(ef([], null))).toBeNull();
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
