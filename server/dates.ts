import type { DateRange } from '../shared/types';

const DAY_MS = 86_400_000;
const TUESDAY = 2;

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = toUtc(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Arithmétique sur des dates calendaires en UTC : les changements d'heure n'ont aucun effet.
export function addDays(iso: string, n: number): string {
  return new Date(toUtc(iso).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

export function todayInParis(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function upcomingTuesday(today: string): string {
  const delta = (TUESDAY - toUtc(today).getUTCDay() + 7) % 7;
  return addDays(today, delta);
}

export function periodsFor(airDate: string): { past: DateRange; next: DateRange } {
  return {
    past: { from: addDays(airDate, -6), to: airDate },
    next: { from: addDays(airDate, 1), to: addDays(airDate, 7) },
  };
}
