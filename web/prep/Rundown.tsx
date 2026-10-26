import { SECTION_LABELS, SECTIONS } from '../../shared/sections';
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
    <div className="rundown-parts">
      {SECTIONS.map((section) => {
        const part = films.filter((f) => f.section === section);
        return (
          <section key={section} className="rundown-part" aria-labelledby={`rundown-${section}`}>
            <h3 id={`rundown-${section}`} className="rundown-part-title">{SECTION_LABELS[section]}</h3>
            {part.length === 0 ? (
              <p className="rundown-empty">Aucun film</p>
            ) : (
              <ol className="rundown">
                {part.map((ef, k) => {
                  const active = ef.film.id === activeId;
                  const title = ef.film.title;
                  return (
                    <li key={ef.film.id} className={active ? 'is-active' : undefined}>
                      <span className="rundown-n">{films.indexOf(ef) + 1}</span>
                      <button type="button" className="rundown-pick" aria-current={active ? 'true' : undefined}
                        onClick={() => onSelect(ef.film.id)}>
                        <strong>{title}</strong>
                        <span>{ef.score === null ? 'pas encore noté' : `${ef.score}/10`}</span>
                      </button>
                      <button type="button" className="icon-btn" aria-label={`Monter ${title}`} disabled={k === 0}
                        onClick={() => onMove(ef.film.id, -1)}>
                        <ChevronUp />
                      </button>
                      <button type="button" className="icon-btn" aria-label={`Descendre ${title}`}
                        disabled={k === part.length - 1} onClick={() => onMove(ef.film.id, 1)}>
                        <ChevronDown />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
