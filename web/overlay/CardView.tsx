import type { EmissionFilm } from '../../shared/types';
import { Grain } from '../components/Grain';
import { Poster } from '../components/Poster';
import { releaseKicker, yearOf } from '../format';

interface Props {
  ef: EmissionFilm;
  position: number;
  total: number;
}

export function FilmCounter({ position, total }: { position: number; total: number }) {
  return (
    <div className="ov-badge">
      <span className="logo">Avant-Première</span>
      <span className="sep" />
      <span className="label">
        Film {position + 1} / {total}
      </span>
    </div>
  );
}

export function CardView({ ef, position, total }: Props) {
  const { film } = ef;
  const meta = [film.genres.slice(0, 2).join(', '), yearOf(film.releaseDateFr)].filter(Boolean).join(' · ');
  return (
    <>
      <FilmCounter position={position} total={total} />
      <div className="ov-card">
        <div className="ov-card-inner">
          <Poster url={film.posterUrl} title={film.title} />
          <div className="ov-card-info">
            <span className="ov-kicker">{releaseKicker(ef.period, film.releaseDateFr)}</span>
            <h1 className={`ov-title${film.title.length > 28 ? ' ov-title--long' : ''}`}>{film.title}</h1>
            <div className="ov-rule" />
            <div className="ov-credits">
              {film.directors.length > 0 && (
                <span>
                  <span className="label">Réalisé par</span>
                  {film.directors.join(', ')}
                </span>
              )}
              {film.cast.length > 0 && (
                <span>
                  <span className="label">Avec</span>
                  {film.cast.slice(0, 3).join(', ')}
                </span>
              )}
              {meta && <span className="ov-muted">{meta}</span>}
            </div>
          </div>
        </div>
        <Grain variant="card" />
      </div>
    </>
  );
}
