// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseSummary } from '../../shared/types';
import { ReleaseGrid } from './ReleaseGrid';

const films: ReleaseSummary[] = Array.from({ length: 10 }, (_, i) => ({
  id: `tmdb:${i}`,
  title: `Film ${i}`,
  posterUrl: null,
  year: '2026',
}));

/** jsdom ne calcule aucune mise en page : on fixe à la main les dimensions de la rangée. */
function layout(track: HTMLElement, { scrollLeft, clientWidth, scrollWidth }: Record<string, number>) {
  Object.defineProperty(track, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(track, 'scrollWidth', { configurable: true, value: scrollWidth });
  track.scrollLeft = scrollLeft!;
  fireEvent.scroll(track);
}

function setup() {
  const onToggle = vi.fn();
  render(<ReleaseGrid heading="Déjà sortis" films={films} loading={false} selected={new Set(['tmdb:2'])} onToggle={onToggle} />);
  const track = screen.getByRole('list', { name: 'Déjà sortis' });
  const scrollBy = vi.fn();
  track.scrollBy = scrollBy as unknown as typeof track.scrollBy;
  return { onToggle, track, scrollBy };
}

describe('carrousel des sorties', () => {
  afterEach(cleanup);

  it('montre tous les films sur une seule rangée', () => {
    const { track } = setup();
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('10 films')).toBeTruthy();
  });

  it('avance et recule d’une largeur visible avec les flèches', () => {
    const { track, scrollBy } = setup();
    layout(track, { scrollLeft: 0, clientWidth: 600, scrollWidth: 2000 });
    const prev = screen.getByRole('button', { name: 'Films précédents' }) as HTMLButtonElement;
    const next = screen.getByRole('button', { name: 'Films suivants' }) as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 600, behavior: 'smooth' });

    layout(track, { scrollLeft: 1400, clientWidth: 600, scrollWidth: 2000 });
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(true);
    fireEvent.click(prev);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -600, behavior: 'smooth' });
  });

  it('cache les flèches quand tout tient à l’écran', () => {
    const { track } = setup();
    layout(track, { scrollLeft: 0, clientWidth: 2000, scrollWidth: 2000 });
    expect(screen.queryByRole('button', { name: 'Films suivants' })).toBeNull();
  });

  it('garde le choix des films', () => {
    const { onToggle } = setup();
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes[2]!.checked).toBe(true);
    fireEvent.click(boxes[0]!);
    expect(onToggle).toHaveBeenCalledWith(films[0], true);
  });
});
