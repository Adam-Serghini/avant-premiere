import { describe, expect, it } from 'vitest';
import { hasPrivateContent } from './notes';

const empty = { opinion: '', anecdotes: '', extendedUniverse: '', score: null };

describe('notes privées', () => {
  it('détecte une section remplie ou une note sur 10', () => {
    expect(hasPrivateContent(empty)).toBe(false);
    expect(hasPrivateContent({ ...empty, opinion: '   ' })).toBe(false);
    expect(hasPrivateContent({ ...empty, anecdotes: 'Tourné en 35 mm' })).toBe(true);
    expect(hasPrivateContent({ ...empty, extendedUniverse: 'Roman de 1862' })).toBe(true);
    expect(hasPrivateContent({ ...empty, score: 0 })).toBe(true);
  });
});
