import type { ReleaseSummary } from '../../shared/types';
import { Poster } from '../components/Poster';

interface Props {
  heading: string;
  films: ReleaseSummary[] | null;
  loading: boolean;
  selected: Set<string>;
  onToggle(film: ReleaseSummary, checked: boolean): void;
}

export function ReleaseGrid({ heading, films, loading, selected, onToggle }: Props) {
  const count = films ? `${films.length} film${films.length > 1 ? 's' : ''}` : '';
  return (
    <section className="period">
      <div className="period-head">
        <h2>{heading}</h2>
        <span className="rule" />
        <span className="count">{loading ? 'Chargement…' : count}</span>
      </div>
      {!loading && films?.length === 0 && <p className="empty">Aucune sortie trouvée sur TMDB pour cette période.</p>}
      <div className="release-grid">
        {(films ?? []).map((f) => {
          const on = selected.has(f.id);
          return (
            <label key={f.id} className={`release-card${on ? ' is-on' : ''}`}>
              <Poster url={f.posterUrl} title={f.title} />
              <span className="release-title">{f.title}</span>
              <span className="release-check">
                <input type="checkbox" checked={on} onChange={(e) => onToggle(f, e.target.checked)} />
                {on ? 'Au programme' : 'Ajouter au live'}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
