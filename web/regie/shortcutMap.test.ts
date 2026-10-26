import { describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUTS } from '../../shared/shortcuts';
import { assignKey, keyLabel, swapKeys } from './shortcutMap';

describe('carte des raccourcis', () => {
  it('attribue une touche libre', () => {
    const result = assignKey(DEFAULT_SHORTCUTS, 'next', { code: 'KeyN', label: 'N' });
    expect(result).toEqual({ map: { ...DEFAULT_SHORTCUTS, next: { code: 'KeyN', label: 'N' } } });
  });

  it('signale la touche déjà prise, pavé numérique compris', () => {
    expect(assignKey(DEFAULT_SHORTCUTS, 'next', { code: 'Numpad1', label: '1' })).toEqual({ conflict: 'full' });
  });

  it('accepte de réattribuer sa propre touche', () => {
    expect(assignKey(DEFAULT_SHORTCUTS, 'full', { code: 'Numpad1', label: '1' })).toHaveProperty('map');
  });

  it('échange les touches de deux actions', () => {
    const swapped = swapKeys(DEFAULT_SHORTCUTS, 'next', 'full');
    expect(swapped?.next).toEqual(DEFAULT_SHORTCUTS.full);
    expect(swapped?.full).toEqual(DEFAULT_SHORTCUTS.next);
    expect(swapped?.prev).toEqual(DEFAULT_SHORTCUTS.prev);
  });

  it('refuse un échange qui laisserait une action obligatoire sans touche', () => {
    const map = { ...DEFAULT_SHORTCUTS, back: null };
    expect(swapKeys(map, 'back', 'next')).toBeNull();
    expect(assignKey(map, 'back', DEFAULT_SHORTCUTS.next!)).toEqual({ conflict: 'next' });
    expect(swapKeys(map, 'back', 'forward')).not.toBeNull();
  });

  it('donne un nom lisible aux touches', () => {
    expect(keyLabel('ArrowRight', 'ArrowRight')).toBe('→');
    expect(keyLabel(' ', 'Space')).toBe('Espace');
    expect(keyLabel('&', 'Digit1')).toBe('&');
    expect(keyLabel('n', 'KeyN')).toBe('N');
    expect(keyLabel('F5', 'F5')).toBe('F5');
    expect(keyLabel('Dead', 'BracketLeft')).toBe('BracketLeft');
  });
});
