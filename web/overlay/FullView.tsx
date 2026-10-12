import type { EmissionFilm } from '../../shared/types';
import { Grain } from '../components/Grain';
import { Poster } from '../components/Poster';
import { releaseKicker, yearOf } from '../format';

interface Props {
  ef: EmissionFilm;
  position: number;
  total: number;
}

const PERFORATIONS = Array.from({ length: 80 }, (_, i) => i);

export function FullView({ ef, position, total }: Props) {
  const { film } = ef;
  const meta = [film.genres.slice(0, 2).join(', '), yearOf(film.releaseDateFr)].filter(Boolean).join(' · ');
  return (
    <div className="ov-full">
      <div className="perforations" aria-hidden="true">
        {PERFORATIONS.map((i) => (
          <span key={i} />
        ))}
      </div>
      <div className="ov-full-body">
        <div className="ov-full-poster">
          <Poster url={film.posterUrl} title={film.title} />
        </div>
        <div className="ov-full-info">
          <div className="ov-full-meta">
            <span className="ov-kicker">{releaseKicker(ef.period, film.releaseDateFr)}</span>
            {meta && <span className="label">{meta}</span>}
          </div>
          <h1 className={`ov-title${film.title.length > 24 ? ' ov-title--long' : ''}`}>{film.title}</h1>
          <div className="ov-ornament" aria-hidden="true">
            <span />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z" />
            </svg>
            <span />
          </div>
          <div className="ov-full-credits">
            {film.directors.length > 0 && (
              <>
                <span className="label">Réalisation</span>
                <span>{film.directors.join(', ')}</span>
              </>
            )}
            {film.cast.length > 0 && (
              <>
                <span className="label">Distribution</span>
                <span>{film.cast.join(', ')}</span>
              </>
            )}
          </div>
          {film.synopsis && <p className="ov-synopsis">{film.synopsis}</p>}
        </div>
      </div>
      <div className="ov-full-footer">
        <span className="logo">Avant-Première</span>
        <span className="label">
          Film {position + 1} / {total}
        </span>
      </div>
      <Grain variant="screen" />
    </div>
  );
}
