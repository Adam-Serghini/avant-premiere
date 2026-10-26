// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fitText, useFitText } from './fitText';

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

describe('useFitText', () => {
  afterEach(cleanup);

  function Probe({ text }: { text: string }) {
    const ref = useRef<HTMLParagraphElement>(null);
    useFitText(ref, [text]);
    return <p ref={ref}>{text}</p>;
  }

  it('réajuste quand le texte change et se détache au démontage', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return (this.textContent!.length > 10 ? 4 : 1) * parseFloat(this.style.fontSize) * 1.45;
    });
    const vw = window.innerWidth / 100;
    const { container, rerender, unmount } = render(<Probe text="court" />);
    const p = container.querySelector('p')!;
    expect(parseFloat(p.style.fontSize)).toBeCloseTo(1.9 * vw, 2);
    rerender(<Probe text="un texte nettement plus long" />);
    expect(parseFloat(p.style.fontSize)).toBeLessThan(1.9 * vw);
    expect(parseFloat(p.style.fontSize)).toBeGreaterThanOrEqual(1.2 * vw);
    const removed = vi.spyOn(window, 'removeEventListener');
    unmount();
    expect(removed).toHaveBeenCalledWith('resize', expect.any(Function));
    vi.restoreAllMocks();
  });

  it('ne boucle pas avec un pas nul', () => {
    const el = makeEl(50);
    expect(fitText(el, { maxPx: 24, minPx: 16, stepPx: 0 }).fontPx).toBe(16);
  });
});
