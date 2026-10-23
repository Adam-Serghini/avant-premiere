import { useRef, useState, type FormEvent } from 'react';
import type { Film, ManualFilmInput } from '../../shared/types';
import { api, errorMessage } from '../api';

interface Props {
  /** Fiche à modifier ; absente pour une création. */
  initial?: Film;
  initialTitle?: string;
  submitLabel: string;
  cancelLabel: string;
  onSaved(film: Film): void;
  onCancel(): void;
}

const youtubeUrl = (film?: Film) => {
  // Fiche TMDB : seule la bande-annonce ajoutée par l’utilisateur (la dernière) est modifiable.
  const trailer = film?.source === 'tmdb'
    ? (film.editedFields.includes('extraTrailer') ? film.trailers.at(-1) : undefined)
    : film?.trailers[0];
  return trailer ? `https://youtu.be/${trailer.key}` : '';
};

export function ManualFilmForm({ initial, initialTitle = '', submitLabel, cancelLabel, onSaved, onCancel }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Fiche déjà enregistrée : un nouvel essai après l'échec d'un envoi la modifie au lieu d'en créer une autre.
  const saved = useRef<Film | null>(initial ?? null);
  const posterInput = useRef<HTMLInputElement>(null);
  const trailerInput = useRef<HTMLInputElement>(null);
  const isTmdb = initial?.source === 'tmdb';

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const text = (k: string) => String(data.get(k) ?? '').trim();
    const list = (k: string) => text(k).split(',').map((s) => s.trim()).filter(Boolean);
    const input: ManualFilmInput = { title: text('title') };
    if (text('releaseDateFr')) input.releaseDateFr = text('releaseDateFr');
    if (list('directors').length) input.directors = list('directors');
    if (list('cast').length) input.cast = list('cast');
    if (list('genres').length) input.genres = list('genres');
    if (text('runtimeMin')) input.runtimeMin = Number(text('runtimeMin'));
    if (text('synopsis')) input.synopsis = text('synopsis');
    if (!isTmdb && text('posterUrl')) input.posterUrl = text('posterUrl');
    const posterFile = posterInput.current?.files?.[0];
    const trailerFile = trailerInput.current?.files?.[0];
    // La vidéo de l'ordinateur remplace le lien YouTube.
    if (text('trailerUrl') && !trailerFile) input.trailerUrl = text('trailerUrl');

    setBusy(true);
    setError(null);
    try {
      let film = saved.current ? await api.updateManual(saved.current.id, input) : await api.createManual(input);
      saved.current = film;
      if (posterFile) film = await api.uploadPoster(film.id, posterFile);
      if (trailerFile) film = await api.uploadTrailer(film.id, trailerFile);
      onSaved(film);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="dialog-body" onSubmit={(e) => void submit(e)}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="mf-title">Titre *</label>
          <input id="mf-title" name="title" required defaultValue={initial?.title ?? initialTitle} />
        </div>
        <div className="field">
          <label htmlFor="mf-date">Date de sortie</label>
          <input id="mf-date" name="releaseDateFr" type="date" defaultValue={initial?.releaseDateFr ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="mf-dir">Réalisation (séparer par des virgules)</label>
          <input id="mf-dir" name="directors" defaultValue={initial?.directors.join(', ') ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="mf-cast">Acteurs (séparer par des virgules)</label>
          <input id="mf-cast" name="cast" defaultValue={initial?.cast.join(', ') ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="mf-genres">Genres (séparer par des virgules)</label>
          <input id="mf-genres" name="genres" defaultValue={initial?.genres.join(', ') ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="mf-runtime">Durée (minutes)</label>
          <input id="mf-runtime" name="runtimeMin" type="number" inputMode="numeric" min={1} max={999}
            defaultValue={initial?.runtimeMin ?? ''} />
        </div>
        <div className="field field--wide">
          <label htmlFor="mf-synopsis">Résumé</label>
          <textarea id="mf-synopsis" name="synopsis" rows={4} maxLength={5000} defaultValue={initial?.synopsis ?? ''} />
        </div>
        <div className="field">
          {!isTmdb && (
            <>
              <label htmlFor="mf-poster">Lien de l’affiche</label>
              <input id="mf-poster" name="posterUrl" type="url" defaultValue={initial?.posterUrl ?? ''} />
            </>
          )}
          <label htmlFor="mf-poster-file" className="field-sub">Ou une image de l’ordinateur (jpg, png, webp)</label>
          <input id="mf-poster-file" ref={posterInput} type="file" accept="image/jpeg,image/png,image/webp" />
        </div>
        <div className="field">
          <label htmlFor="mf-trailer">{isTmdb ? 'Ajouter une bande-annonce YouTube' : 'Lien YouTube de la bande-annonce'}</label>
          <input id="mf-trailer" name="trailerUrl" type="url" defaultValue={youtubeUrl(initial)} />
          <label htmlFor="mf-trailer-file" className="field-sub">Ou une vidéo de l’ordinateur (mp4, webm)</label>
          <input id="mf-trailer-file" ref={trailerInput} type="file" accept="video/mp4,video/webm" />
          <p className="hint">Si tu choisis une vidéo, elle remplace le lien YouTube.</p>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="toolbar-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>{cancelLabel}</button>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Envoi…' : submitLabel}</button>
      </div>
    </form>
  );
}
