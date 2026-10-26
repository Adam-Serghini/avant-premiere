import { describe, expect, it } from 'vitest';
import { SECTION_LABELS, SECTIONS, sectionCounter, sectionRank } from './sections';

describe('parties', () => {
  it('garde l’ordre et les libellés', () => {
    expect(SECTIONS).toEqual(['seen', 'docu', 'releases', 'classic']);
    expect(SECTIONS.map((s) => SECTION_LABELS[s])).toEqual([
      'Film vu cette semaine',
      'Le coin docu',
      'Sortie de la semaine',
      'Le classique',
    ]);
    expect(SECTIONS.map(sectionRank)).toEqual([0, 1, 2, 3]);
  });

  it('compte la place dans la partie', () => {
    const items = [{ section: 'seen' }, { section: 'docu' }, { section: 'docu' }, { section: 'releases' }] as const;
    expect(sectionCounter(items, 2)).toEqual({ section: 'docu', index: 2, count: 2 });
    expect(sectionCounter(items, 0)).toEqual({ section: 'seen', index: 1, count: 1 });
    expect(sectionCounter([], 0)).toBeNull();
  });
});
