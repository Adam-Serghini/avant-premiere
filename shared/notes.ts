import type { EmissionFilm } from './types';

export type NoteField = 'opinion' | 'anecdotes' | 'extendedUniverse';

export const NOTE_SECTIONS: readonly { field: NoteField; label: string; placeholder: string }[] = [
  { field: 'opinion', label: 'Mon avis', placeholder: 'Points forts, points faibles…' },
  { field: 'anecdotes', label: 'Anecdotes', placeholder: 'Tournage, casting, coulisses…' },
  { field: 'extendedUniverse', label: 'Univers étendu', placeholder: 'Livre d’origine, autres adaptations, suites…' },
];

/** Vrai si le film porte des notes ou une note sur 10 qu'un retrait ferait perdre. */
export function hasPrivateContent(ef: Pick<EmissionFilm, NoteField | 'score'>): boolean {
  return NOTE_SECTIONS.some(({ field }) => ef[field].trim() !== '') || ef.score !== null;
}
