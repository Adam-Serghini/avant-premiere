import type { Period, Ratings } from '../shared/types';

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' });
const WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' });

function utc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function formatDateFr(iso: string | null): string {
  if (!iso) return '';
  const d = utc(iso);
  const day = d.getUTCDate();
  return `${day === 1 ? '1er' : day} ${MONTH.format(d)}`;
}

export function formatAirDate(iso: string): string {
  return `${WEEKDAY.format(utc(iso))} ${formatDateFr(iso)}`;
}

export function releaseKicker(period: Period, date: string | null): string {
  if (!date) return period === 'past' ? 'Déjà sorti' : 'À venir';
  return `${period === 'past' ? 'Sorti' : 'Sort'} le ${formatDateFr(date)}`;
}

export function formatRuntime(min: number | null): string {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

/** « IMDb 7,4 · Rotten Tomatoes 85 % · Metacritic 72 », seulement les notes connues. */
export function formatRatings(r: Ratings | null): string {
  if (!r) return '';
  return [
    r.imdb !== null && `IMDb ${r.imdb.toFixed(1).replace('.', ',')}`,
    r.rottenTomatoes !== null && `Rotten Tomatoes ${r.rottenTomatoes} %`,
    r.metacritic !== null && `Metacritic ${r.metacritic}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function yearOf(iso: string | null): string {
  return iso ? iso.slice(0, 4) : '';
}

export function parseScore(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(0, n));
}

export function readDateParam(search: string): string | null {
  const raw = new URLSearchParams(search).get('date');
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return utc(raw).toISOString().slice(0, 10) === raw ? raw : null;
}
