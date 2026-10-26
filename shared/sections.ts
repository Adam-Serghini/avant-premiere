export type Section = 'seen' | 'docu' | 'releases' | 'classic';

export const SECTIONS: readonly Section[] = ['seen', 'docu', 'releases', 'classic'];

export const SECTION_LABELS: Record<Section, string> = {
  seen: 'Film vu cette semaine',
  docu: 'Le coin docu',
  releases: 'Sortie de la semaine',
  classic: 'Le classique',
};

export function sectionRank(s: Section): number {
  return SECTIONS.indexOf(s);
}

/** Place du film à `position` dans sa partie : « 2 sur 3 » donne index 2, count 3. */
export function sectionCounter(
  items: readonly { section: Section }[],
  position: number,
): { section: Section; index: number; count: number } | null {
  const item = items[position];
  if (!item) return null;
  const same = items.filter((i) => i.section === item.section);
  return { section: item.section, index: items.slice(0, position + 1).filter((i) => i.section === item.section).length, count: same.length };
}
