import { useState } from 'react';
import type { Emission, EmissionFilm } from '../../shared/types';
import { NOTE_SECTIONS } from '../../shared/notes';
import { effectiveTrailer, LOCAL_TRAILER, trailerLabels } from '../../shared/trailer';
import { api } from '../api';
import { formatRatings, formatRuntime, parseScore, releaseKicker, yearOf } from '../format';
import { useAutosave, type SaveStatus } from '../hooks/useAutosave';
import { EditFilmDialog } from './EditFilmDialog';
import { PosterControl, VideoControl } from './MediaControls';

interface Props {
  airDate: string;
  ef: EmissionFilm;
  onSaved(emission: Emission): void;
  onRemove(): void;
  onRefresh(): void;
  onFilmChanged(): void;
  onError(e: unknown): void;
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: '',
  pending: 'Enregistrement…',
  saved: 'Enregistré',
  error: 'Non enregistré, nouvel essai…',
};

export function FilmSheet({ airDate, ef, onSaved, onRemove, onRefresh, onFilmChanged, onError }: Props) {
  const { film } = ef;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    opinion: ef.opinion,
    anecdotes: ef.anecdotes,
    extendedUniverse: ef.extendedUniverse,
    score: ef.score,
  });
  const { status, errorMessage } = useAutosave(draft, async (d) => {
    onSaved(await api.patchFilm(airDate, film.id, d));
  });
  const labels = trailerLabels(film.trailers);
  const currentTrailer = effectiveTrailer(ef);

  async function chooseTrailer(key: string) {
    try {
      onSaved(await api.patchFilm(airDate, film.id, { trailerKey: key }));
    } catch (e) {
      onError(e);
    }
  }

  async function resetFilm() {
    if (!window.confirm('Effacer tes corrections et revenir aux infos de TMDB ?')) return;
    try {
      await api.resetFilm(film.id);
      onFilmChanged();
    } catch (e) {
      onError(e);
    }
  }

  const meta = [
    film.genres.slice(0, 2).join(', '),
    yearOf(film.releaseDateFr),
    formatRuntime(film.runtimeMin),
    film.directors.length > 0 ? `de ${film.directors.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const ratings = formatRatings(film.ratings);

  return (
    <section className="sheet" aria-labelledby="sheet-title">
      <div className="sheet-head">
        <span className="sheet-kicker">Fiche · {releaseKicker(ef.period, film.releaseDateFr)}</span>
        <h3 id="sheet-title">{film.title}</h3>
        {meta && <p className="sheet-meta">{meta}</p>}
        {film.cast.length > 0 && <p className="sheet-meta">Avec {film.cast.join(', ')}</p>}
        {ratings && <p className="sheet-meta">{ratings}</p>}
      </div>
      <PosterControl film={film} onChanged={onFilmChanged} />

      <p className="hint">Tes notes restent visibles par toi seul, jamais à l’antenne.</p>
      {NOTE_SECTIONS.map(({ field, label, placeholder }) => (
        <div className="field" key={field}>
          <label htmlFor={`note-${field}`}>{label}</label>
          <textarea id={`note-${field}`} rows={4} maxLength={20000} value={draft[field]} placeholder={placeholder}
            onChange={(e) => {
              const value = e.target.value;
              setDraft((d) => ({ ...d, [field]: value }));
            }} />
        </div>
      ))}

      <div className="sheet-row">
        <div className="field">
          <label htmlFor="score">Ma note</label>
          <div className="score">
            <input id="score" type="number" inputMode="numeric" min={0} max={10} placeholder="–"
              value={draft.score ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, score: parseScore(e.target.value) }))} />
            <span>/ 10</span>
          </div>
        </div>
        <fieldset className="field">
          <legend>Bande-annonce</legend>
          {film.trailers.length === 0 && !film.localTrailerUrl ? (
            <p className="hint">Aucune bande-annonce trouvée.</p>
          ) : (
            <div className="chips">
              {film.trailers.map((t, i) => (
                <button key={t.key} type="button" className="btn" title={t.name}
                  aria-pressed={currentTrailer?.kind === 'youtube' && currentTrailer.key === t.key}
                  onClick={() => void chooseTrailer(t.key)}>
                  {labels[i]}
                </button>
              ))}
              {film.localTrailerUrl && (
                <button type="button" className="btn" aria-pressed={currentTrailer?.kind === 'local'}
                  onClick={() => void chooseTrailer(LOCAL_TRAILER)}>
                  Vidéo locale
                </button>
              )}
            </div>
          )}
          <VideoControl airDate={airDate} ef={ef} onSaved={onSaved} onChanged={onFilmChanged} />
        </fieldset>
      </div>

      <p className={`save-status${status === 'error' ? ' is-error' : ''}`} aria-live="polite">
        {status === 'error' && errorMessage ? `Non enregistré : ${errorMessage}` : STATUS_TEXT[status]}
      </p>
      {film.source === 'tmdb' && film.editedFields.length > 0 && <p className="hint">Fiche corrigée par toi</p>}
      <div className="toolbar-actions">
        {film.source === 'tmdb' && (
          <button type="button" className="btn btn--ghost" onClick={onRefresh}>Actualiser la fiche</button>
        )}
        <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>Modifier la fiche</button>
        {film.source === 'tmdb' && film.editedFields.length > 0 && (
          <button type="button" className="btn btn--ghost" onClick={() => void resetFilm()}>Revenir aux infos TMDB</button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onRemove}>Retirer du live</button>
      </div>
      <EditFilmDialog film={editing ? film : null} onClose={() => setEditing(false)} onSaved={onFilmChanged} />
    </section>
  );
}
