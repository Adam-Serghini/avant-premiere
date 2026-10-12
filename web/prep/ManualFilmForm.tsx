import { useState, type FormEvent } from 'react';
import type { Film, ManualFilmInput } from '../../shared/types';
import { api, errorMessage } from '../api';

interface Props {
  onCreated(film: Film): void;
  onCancel(): void;
}

export function ManualFilmForm({ onCreated, onCancel }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const text = (k: string) => String(data.get(k) ?? '').trim();
    const list = (k: string) => text(k).split(',').map((s) => s.trim()).filter(Boolean);
    const input: ManualFilmInput = { title: text('title') };
    if (text('releaseDateFr')) input.releaseDateFr = text('releaseDateFr');
    if (list('directors').length) input.directors = list('directors');
    if (list('cast').length) input.cast = list('cast');
    if (text('posterUrl')) input.posterUrl = text('posterUrl');
    if (text('trailerUrl')) input.trailerUrl = text('trailerUrl');
    setBusy(true);
    try {
      onCreated(await api.createManual(input));
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
          <input id="mf-title" name="title" required />
        </div>
        <div className="field">
          <label htmlFor="mf-date">Date de sortie</label>
          <input id="mf-date" name="releaseDateFr" type="date" />
        </div>
        <div className="field">
          <label htmlFor="mf-dir">Réalisation (séparer par des virgules)</label>
          <input id="mf-dir" name="directors" />
        </div>
        <div className="field">
          <label htmlFor="mf-cast">Acteurs (séparer par des virgules)</label>
          <input id="mf-cast" name="cast" />
        </div>
        <div className="field">
          <label htmlFor="mf-poster">Lien de l’affiche</label>
          <input id="mf-poster" name="posterUrl" type="url" />
        </div>
        <div className="field">
          <label htmlFor="mf-trailer">Lien YouTube de la bande-annonce</label>
          <input id="mf-trailer" name="trailerUrl" type="url" />
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="toolbar-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Retour à la recherche</button>
        <button type="submit" className="btn btn--primary" disabled={busy}>Créer et ajouter</button>
      </div>
    </form>
  );
}
