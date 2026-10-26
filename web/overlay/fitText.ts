import { useLayoutEffect, type RefObject } from 'react';

interface FitOpts { maxPx: number; minPx: number; stepPx: number }

/** Réduit la taille du texte jusqu'à ce qu'il tienne dans sa boîte ; en dernier recours, coupe par lignes. */
export function fitText(el: HTMLElement, { maxPx, minPx, stepPx }: FitOpts): { fontPx: number; clamped: boolean } {
  let fontPx = maxPx;
  el.classList.remove('is-clamped');
  el.style.fontSize = `${fontPx}px`;
  const step = stepPx > 0 ? stepPx : maxPx - minPx;
  while (el.scrollHeight > el.clientHeight && fontPx > minPx) {
    fontPx = Math.max(minPx, Math.round((fontPx - step) * 1000) / 1000);
    el.style.fontSize = `${fontPx}px`;
  }
  const clamped = el.scrollHeight > el.clientHeight;
  if (clamped) {
    // Nombre de lignes qui tiennent dans la hauteur disponible
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    const lines = lineHeight > 0 ? Math.max(1, Math.floor(el.clientHeight / lineHeight)) : 1;
    el.style.setProperty('--clamp-lines', String(lines));
    el.classList.add('is-clamped');
  }
  return { fontPx, clamped };
}

/** Ajuste le texte au montage, quand `deps` change, après le chargement des polices et au redimensionnement. */
export function useFitText(ref: RefObject<HTMLElement | null>, deps: unknown[]): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let off = false;
    const fit = () => {
      if (off) return;
      const vw = window.innerWidth / 100;
      fitText(el, { maxPx: 1.9 * vw, minPx: 1.2 * vw, stepPx: 0.05 * vw });
    };
    fit();
    window.addEventListener('resize', fit);
    document.fonts?.ready.then(fit).catch(() => {});
    // La place du résumé dépend de tout ce qui le précède : on réajuste quand elle change
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    ro?.observe(el);
    if (el.parentElement) ro?.observe(el.parentElement);
    return () => {
      off = true;
      ro?.disconnect();
      window.removeEventListener('resize', fit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
