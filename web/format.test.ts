import { describe, expect, it } from 'vitest';
import { formatRatings, formatAirDate, formatDateFr, formatRuntime, parseScore, readDateParam, releaseKicker, yearOf } from './format';

describe('formatage', () => {
  it('formate les dates en français', () => {
    expect(formatDateFr('2026-10-14')).toBe('14 octobre');
    expect(formatDateFr('2026-10-01')).toBe('1er octobre');
    expect(formatDateFr(null)).toBe('');
    expect(formatAirDate('2026-10-13')).toBe('mardi 13 octobre');
  });

  it('annonce la sortie par rapport à l’émission', () => {
    expect(releaseKicker('2026-10-27', '2026-10-22')).toBe('Sorti le 22 octobre');
    expect(releaseKicker('2026-10-27', '2026-10-29')).toBe('Sort le 29 octobre');
    expect(releaseKicker('2026-10-27', null)).toBe('');
    expect(releaseKicker(null, '2026-10-22')).toBe('');
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

  it('formate les notes IMDb, Rotten Tomatoes et Metacritic', () => {
    expect(formatRatings({ imdb: 7.4, rottenTomatoes: 85, metacritic: 72 })).toBe(
      'IMDb 7,4 · Rotten Tomatoes 85 % · Metacritic 72',
    );
    expect(formatRatings({ imdb: 8, rottenTomatoes: null, metacritic: null })).toBe('IMDb 8,0');
    expect(formatRatings({ imdb: null, rottenTomatoes: 91, metacritic: 60 })).toBe('Rotten Tomatoes 91 % · Metacritic 60');
    expect(formatRatings({ imdb: null, rottenTomatoes: null, metacritic: null })).toBe('');
    expect(formatRatings(null)).toBe('');
  });

  it('ignore une date d’URL invalide', () => {
    expect(readDateParam('?date=2026-10-13')).toBe('2026-10-13');
    expect(readDateParam('?date=hier')).toBeNull();
    expect(readDateParam('?date=2026-02-30')).toBeNull();
    expect(readDateParam('')).toBeNull();
  });
});
