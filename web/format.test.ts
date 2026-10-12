import { describe, expect, it } from 'vitest';
import { formatAirDate, formatDateFr, formatRuntime, parseScore, readDateParam, releaseKicker, yearOf } from './format';

describe('formatage', () => {
  it('formate les dates en français', () => {
    expect(formatDateFr('2026-10-14')).toBe('14 octobre');
    expect(formatDateFr('2026-10-01')).toBe('1er octobre');
    expect(formatDateFr(null)).toBe('');
    expect(formatAirDate('2026-10-13')).toBe('mardi 13 octobre');
  });

  it('annonce la sortie selon la période', () => {
    expect(releaseKicker('past', '2026-10-07')).toBe('Sorti le 7 octobre');
    expect(releaseKicker('next', '2026-10-14')).toBe('Sort le 14 octobre');
    expect(releaseKicker('past', null)).toBe('Déjà sorti');
    expect(releaseKicker('next', null)).toBe('À venir');
  });

  it('formate durée et année', () => {
    expect(formatRuntime(105)).toBe('1 h 45');
    expect(formatRuntime(120)).toBe('2 h 00');
    expect(formatRuntime(48)).toBe('48 min');
    expect(formatRuntime(null)).toBe('');
    expect(yearOf('1967-10-25')).toBe('1967');
    expect(yearOf(null)).toBe('');
  });

  it('lit une note sur 10', () => {
    expect(parseScore('')).toBeNull();
    expect(parseScore('7')).toBe(7);
    expect(parseScore('12')).toBe(10);
    expect(parseScore('-3')).toBe(0);
    expect(parseScore('6.6')).toBe(7);
    expect(parseScore('abc')).toBeNull();
  });

  it('ignore une date d’URL invalide', () => {
    expect(readDateParam('?date=2026-10-13')).toBe('2026-10-13');
    expect(readDateParam('?date=hier')).toBeNull();
    expect(readDateParam('?date=2026-02-30')).toBeNull();
    expect(readDateParam('')).toBeNull();
  });
});
