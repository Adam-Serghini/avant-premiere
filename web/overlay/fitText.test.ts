// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fitText } from './fitText';

const opts = { maxPx: 24, minPx: 16, stepPx: 1 };

/** Un élément de 100 px de haut dont la hauteur de contenu vaut lignes × taille × 1,45. */
function makeEl(lines: number) {
  const el = document.createElement('p');
  Object.defineProperty(el, 'clientHeight', { value: 100 });
  Object.defineProperty(el, 'scrollHeight', { get: () => lines * parseFloat(el.style.fontSize) * 1.45, configurable: true });
  return el;
}

describe('fitText', () => {
  it('garde la taille maximale quand le texte tient', () => {
    const el = makeEl(2);
    expect(fitText(el, opts)).toEqual({ fontPx: 24, clamped: false });
    expect(el.style.fontSize).toBe('24px');
    expect(el.classList.contains('is-clamped')).toBe(false);
  });

  it('descend jusqu’à la première taille qui tient', () => {
    // 4 lignes : 4 × f × 1,45 <= 100 => f <= 17,24 => 17
    const el = makeEl(4);
    expect(fitText(el, opts)).toEqual({ fontPx: 17, clamped: false });
    expect(el.style.fontSize).toBe('17px');
    expect(el.classList.contains('is-clamped')).toBe(false);
  });

  it('coupe par lignes en dernier recours', () => {
    const el = makeEl(50);
    expect(fitText(el, opts)).toEqual({ fontPx: 16, clamped: true });
    expect(el.style.fontSize).toBe('16px');
    expect(el.classList.contains('is-clamped')).toBe(true);
  });

  it('retire la coupure quand le texte tient de nouveau', () => {
    const el = makeEl(50);
    fitText(el, opts);
    Object.defineProperty(el, 'scrollHeight', { get: () => 10, configurable: true });
    expect(fitText(el, opts).clamped).toBe(false);
    expect(el.classList.contains('is-clamped')).toBe(false);
  });
});
