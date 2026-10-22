import { displayPoster } from '../../shared/film';
import type { EmissionFilm } from '../../shared/types';
import { Grain } from '../components/Grain';
import { Poster } from '../components/Poster';
import { formatRuntime, releaseKicker, yearOf } from '../format';

interface Props {
  ef: EmissionFilm;
  position: number;
  total: number;
}

/** La Fiche, pensée pour remplir le cadre de gauche de la scène React (référence 1250 × 725). */
export function FullView({ ef, position, total }: Props) {
  const { film } = ef;
  const meta = [film.genres.slice(0, 2).join(', '), yearOf(film.releaseDateFr), formatRuntime(film.runtimeMin)]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="ov-fiche">
      <span className="ov-corner ov-corner--tl" aria-hidden="true" />
      <span className="ov-corner ov-corner--br" aria-hidden="true" />
      <div className="ov-fiche-poster">
        <Poster url={displayPoster(film)} title={film.title} />
      </div>
      <div className="ov-fiche-info">
        <span className="ov-kicker">{releaseKicker(ef.period, film.releaseDateFr)}</span>
        <h1 className={`ov-title${film.title.length > 24 ? ' ov-title--long' : ''}`}>{film.title}</h1>
        <div className="ov-rule" />
        <dl className="ov-credits">
          {film.directors.length > 0 && (
            <>
              <dt>Réalisation</dt>
              <dd>{film.directors.join(', ')}</dd>
            </>
          )}
          {film.cast.length > 0 && (
            <>
              <dt>Avec</dt>
              <dd>{film.cast.slice(0, 4).join(', ')}</dd>
            </>
          )}
        </dl>
        {meta && <p className="ov-meta">{meta}</p>}
        {film.synopsis && <p className="ov-synopsis">{film.synopsis}</p>}
      </div>
      <span className="ov-counter">Film {position + 1} / {total}</span>
      <Grain variant="screen" />
    </div>
  );
}
