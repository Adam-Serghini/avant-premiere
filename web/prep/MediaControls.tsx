import { useId, useState } from 'react';
import { LOCAL_TRAILER } from '../../shared/trailer';
import type { Emission, EmissionFilm, Film } from '../../shared/types';
import { api, errorMessage } from '../api';

function useRunner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

/** Bouton « fichier » accessible : un vrai <label> devant un input caché visuellement. */
function FileButton({ label, accept, disabled, onFile }: { label: string; accept: string; disabled: boolean; onFile(file: File): void }) {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className={`btn btn--ghost${disabled ? ' is-disabled' : ''}`}>{label}</label>
      <input id={id} className="visually-hidden" type="file" accept={accept} disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }} />
    </>
  );
}

export function PosterControl({ film, onChanged }: { film: Film; onChanged(): void }) {
  const { busy, error, run } = useRunner();
  return (
    <div className="media-control">
      <div className="toolbar-actions">
        <FileButton label="Utiliser une autre affiche" accept="image/jpeg,image/png,image/webp" disabled={busy}
          onFile={(file) => void run(async () => {
            await api.uploadPoster(film.id, file);
            onChanged();
          })} />
        {film.customPosterUrl && (
          <button type="button" className="btn btn--ghost" disabled={busy}
            onClick={() => void run(async () => {
              await api.removePoster(film.id);
              onChanged();
            })}>
            {film.source === 'tmdb' ? 'Revenir à l’affiche TMDB' : film.posterUrl ? 'Revenir à l’affiche du lien' : 'Retirer l’affiche'}
          </button>
        )}
      </div>
      {busy && <p className="hint">Envoi…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

interface VideoProps {
  airDate: string;
  ef: EmissionFilm;
  onSaved(emission: Emission): void;
  onChanged(): void;
}

export function VideoControl({ airDate, ef, onSaved, onChanged }: VideoProps) {
  const { film } = ef;
  const { busy, error, run } = useRunner();
  return (
    <div className="media-control">
      <div className="toolbar-actions">
        <FileButton label="Vidéo de l’ordinateur" accept="video/mp4,video/webm" disabled={busy}
          onFile={(file) => void run(async () => {
            await api.uploadTrailer(film.id, file);
            onSaved(await api.patchFilm(airDate, film.id, { trailerKey: LOCAL_TRAILER }));
          })} />
        {film.localTrailerUrl && (
          <button type="button" className="btn btn--ghost" disabled={busy}
            onClick={() => void run(async () => {
              await api.removeTrailer(film.id);
              onChanged();
            })}>
            Retirer la vidéo
          </button>
        )}
      </div>
      {busy && <p className="hint">Envoi…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
