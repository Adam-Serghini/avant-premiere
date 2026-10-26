import { SECTION_LABELS } from '../../shared/sections';
import type { EmissionFilm } from '../../shared/types';
import { ChevronDown, ChevronUp } from '../components/icons';

interface Props {
  films: EmissionFilm[];
  activeId: string | null;
  onSelect(filmId: string): void;
  onMove(filmId: string, delta: -1 | 1): void;
}

export function Rundown({ films, activeId, onSelect, onMove }: Props) {
  return (
    <ol className="rundown">
      {films.map((ef, i) => {
        const active = ef.film.id === activeId;
        const title = ef.film.title;
        return (
          <li key={ef.film.id} className={active ? 'is-active' : undefined}>
            <span className="rundown-n">{i + 1}</span>
            <button type="button" className="rundown-pick" aria-current={active ? 'true' : undefined}
              onClick={() => onSelect(ef.film.id)}>
              <strong>{title}</strong>
              <span>
                {SECTION_LABELS[ef.section]} · {ef.score === null ? 'pas encore noté' : `${ef.score}/10`}
              </span>
            </button>
            <button type="button" className="icon-btn" aria-label={`Monter ${title}`} disabled={i === 0}
              onClick={() => onMove(ef.film.id, -1)}>
              <ChevronUp />
            </button>
            <button type="button" className="icon-btn" aria-label={`Descendre ${title}`} disabled={i === films.length - 1}
              onClick={() => onMove(ef.film.id, 1)}>
              <ChevronDown />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
