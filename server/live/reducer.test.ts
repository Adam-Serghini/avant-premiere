import { describe, expect, it } from 'vitest';
import type { LiveState } from '../../shared/types';
import { clamp, reduce, type LiveContext } from './reducer';

const base: LiveState = { emissionId: 1, airDate: '2026-10-13', position: 0, mode: 'card' };
const ctx = (total: number, withTrailer = true): LiveContext => ({ total, hasTrailerAt: () => withTrailer });

describe('réducteur du live', () => {
  it('avance et recule sans dépasser les bornes', () => {
    let s = reduce(base, { type: 'next' }, ctx(2));
    expect(s.position).toBe(1);
    s = reduce(s, { type: 'next' }, ctx(2));
    expect(s.position).toBe(1);
    s = reduce(s, { type: 'prev' }, ctx(2));
    s = reduce(s, { type: 'prev' }, ctx(2));
    expect(s.position).toBe(0);
  });

  it('reste immobile sans film', () => {
    expect(reduce(base, { type: 'next' }, ctx(0))).toEqual(base);
    expect(reduce(base, { type: 'goto', position: 0 }, ctx(0))).toEqual(base);
  });

  it('va directement à un film valide uniquement', () => {
    expect(reduce(base, { type: 'goto', position: 2 }, ctx(3)).position).toBe(2);
    expect(reduce(base, { type: 'goto', position: 3 }, ctx(3))).toBe(base);
    expect(reduce(base, { type: 'goto', position: -1 }, ctx(3))).toBe(base);
    expect(reduce(base, { type: 'goto', position: 1.5 }, ctx(3))).toBe(base);
  });

  it('change de mode', () => {
    expect(reduce(base, { type: 'setMode', mode: 'full' }, ctx(2)).mode).toBe('full');
    expect(reduce(base, { type: 'setMode', mode: 'off' }, ctx(2)).mode).toBe('off');
  });

  it('refuse la bande-annonce si le film n’en a pas', () => {
    expect(reduce(base, { type: 'setMode', mode: 'trailer' }, ctx(2, false))).toBe(base);
    expect(reduce(base, { type: 'setMode', mode: 'trailer' }, ctx(2, true)).mode).toBe('trailer');
  });

  it('revient sur la carte à la fin de la bande-annonce', () => {
    const playing = { ...base, mode: 'trailer' as const };
    expect(reduce(playing, { type: 'trailerEnded' }, ctx(2)).mode).toBe('card');
    const full = { ...base, mode: 'full' as const };
    expect(reduce(full, { type: 'trailerEnded' }, ctx(2))).toBe(full);
  });

  it('repasse en carte quand on change de film pendant une bande-annonce', () => {
    const playing = { ...base, mode: 'trailer' as const };
    expect(reduce(playing, { type: 'next' }, ctx(2))).toMatchObject({ position: 1, mode: 'card' });
    const full = { ...base, mode: 'full' as const };
    expect(reduce(full, { type: 'next' }, ctx(2))).toMatchObject({ position: 1, mode: 'full' });
  });

  it('démarre une nouvelle émission sur le premier film, en carte', () => {
    const other = { ...base, emissionId: 9, position: 3, mode: 'off' as const };
    expect(reduce(other, { type: 'start', emissionId: 1, airDate: '2026-10-13' }, ctx(4))).toEqual({
      emissionId: 1,
      airDate: '2026-10-13',
      position: 0,
      mode: 'card',
    });
  });

  it('reprend où il en était si c’est la même émission', () => {
    const running = { ...base, position: 2, mode: 'full' as const };
    expect(reduce(running, { type: 'start', emissionId: 1, airDate: '2026-10-13' }, ctx(4))).toEqual(running);
    expect(reduce(running, { type: 'start', emissionId: 1, airDate: '2026-10-13' }, ctx(2)).position).toBe(1);
  });

  it('recadre une position devenue invalide', () => {
    expect(clamp({ ...base, position: 4 }, 2).position).toBe(1);
    expect(clamp({ ...base, position: 4 }, 0).position).toBe(0);
    const ok = { ...base, position: 1 };
    expect(clamp(ok, 2)).toBe(ok);
  });
});
