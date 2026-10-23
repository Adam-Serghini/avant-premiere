import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReleaseSummary } from '../../shared/types';
import { ChevronLeft, ChevronRight } from '../components/icons';
import { Poster } from '../components/Poster';

interface Props {
  heading: string;
  films: ReleaseSummary[] | null;
  loading: boolean;
  selected: Set<string>;
  onToggle(film: ReleaseSummary, checked: boolean): void;
}

interface Edges {
  overflow: boolean;
  atStart: boolean;
  atEnd: boolean;
}

/** Les sorties d'une période sur une seule rangée qui défile, pour éviter une page interminable. */
export function ReleaseGrid({ heading, films, loading, selected, onToggle }: Props) {
  const count = films ? `${films.length} film${films.length > 1 ? 's' : ''}` : '';
  const track = useRef<HTMLUListElement>(null);
  const trackId = useId();
  const [edges, setEdges] = useState<Edges>({ overflow: false, atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    // 1 px de marge : les positions de défilement peuvent être fractionnaires.
    setEdges({
      overflow: scrollWidth > clientWidth + 1,
      atStart: scrollLeft <= 1,
      atEnd: scrollLeft + clientWidth >= scrollWidth - 1,
    });
  }, []);

  useLayoutEffect(measure, [measure, films]);

  useEffect(() => {
    const el = track.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  function page(direction: -1 | 1) {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' });
  }

  return (
    <section className="period">
      <div className="period-head">
        <h2>{heading}</h2>
        <span className="rule" />
        <span className="count">{loading ? 'Chargement…' : count}</span>
        {edges.overflow && (
          <div className="carousel-nav">
            <button type="button" className="icon-btn" aria-label="Films précédents" aria-controls={trackId}
              disabled={edges.atStart} onClick={() => page(-1)}>
              <ChevronLeft />
            </button>
            <button type="button" className="icon-btn" aria-label="Films suivants" aria-controls={trackId}
              disabled={edges.atEnd} onClick={() => page(1)}>
              <ChevronRight />
            </button>
          </div>
        )}
      </div>
      {!loading && films?.length === 0 && <p className="empty">Aucune sortie trouvée sur TMDB pour cette période.</p>}
      <ul ref={track} id={trackId} className="release-track" aria-label={heading} onScroll={measure}>
        {(films ?? []).map((f) => {
          const on = selected.has(f.id);
          return (
            <li key={f.id}>
              <label className={`release-card${on ? ' is-on' : ''}`}>
                <Poster url={f.posterUrl} title={f.title} />
                <span className="release-title">{f.title}</span>
                <span className="release-check">
                  <input type="checkbox" checked={on} onChange={(e) => onToggle(f, e.target.checked)} />
                  {on ? 'Au programme' : 'Ajouter au live'}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
