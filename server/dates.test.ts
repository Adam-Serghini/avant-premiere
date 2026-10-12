import { describe, expect, it } from 'vitest';
import { addDays, isIsoDate, periodsFor, todayInParis, upcomingTuesday } from './dates';

describe('dates', () => {
  it('valide les dates AAAA-MM-JJ réelles uniquement', () => {
    expect(isIsoDate('2026-10-13')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('13/10/2026')).toBe(false);
    expect(isIsoDate('hier')).toBe(false);
  });

  it('ajoute des jours sans être perturbé par les changements d’heure', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-13', -6)).toBe('2026-10-07');
  });

  it('donne la date du jour à Paris', () => {
    expect(todayInParis(new Date('2026-10-12T22:30:00Z'))).toBe('2026-10-13');
    expect(todayInParis(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
    expect(todayInParis(new Date('2026-10-13T10:00:00Z'))).toBe('2026-10-13');
  });

  it('trouve le prochain mardi (aujourd’hui si on est mardi)', () => {
    expect(upcomingTuesday('2026-10-13')).toBe('2026-10-13');
    expect(upcomingTuesday('2026-10-14')).toBe('2026-10-20');
    expect(upcomingTuesday('2026-10-11')).toBe('2026-10-13');
    expect(upcomingTuesday('2026-10-07')).toBe('2026-10-13');
  });

  it('calcule les deux périodes de l’émission', () => {
    expect(periodsFor('2026-10-13')).toEqual({
      past: { from: '2026-10-07', to: '2026-10-13' },
      next: { from: '2026-10-14', to: '2026-10-20' },
    });
  });

  it('calcule les périodes autour du passage à l’heure d’hiver', () => {
    expect(periodsFor('2026-10-27')).toEqual({
      past: { from: '2026-10-21', to: '2026-10-27' },
      next: { from: '2026-10-28', to: '2026-11-03' },
    });
  });
});