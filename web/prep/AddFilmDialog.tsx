import { useEffect, useRef, useState } from 'react';
import type { Period, ReleaseSummary } from '../../shared/types';
import { api, errorMessage } from '../api';
import { CloseIcon } from '../components/icons';
import { Poster } from '../components/Poster';
import { ManualFilmForm } from './ManualFilmForm';

interface Props {
  open: boolean;
  onClose(): void;
  onAdd(filmId: string, period: Period): Promise<string | null>;
}

export function AddFilmDialog({ open, onClose, onAdd }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [period, setPeriod] = useState<Period>('next');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReleaseSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      api.search(q).then(
        (r) => {
          if (cancelled) return;
          setResults(r);
          setError(null);
          setSearching(false);
        },
        (e: unknown) => {
          if (cancelled) return;
          setError(errorMessage(e));
          setSearching(false);
        },
      );
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function close() {
    setQuery('');
    setResults([]);
    setManual(false);
    setError(null);
    setAddError(null);
    onClose();
  }

  async function add(filmId: string) {
    const message = await onAdd(filmId, period);
    if (message === null) close();
    else setAddError(message);
  }

  const openManual = () => {
    setManualTitle(query.trim());
    setManual(true);
  };

  const showNoResult = !searching && !error && query.trim().length >= 2 && results.length === 0;

  return (
    <dialog ref={ref} className="add-dialog" onClose={close} aria-labelledby="add-title">
      <div className="dialog-head">
        <h2 id="add-title">Ajouter un film</h2>
        <button type="button" className="icon-btn" aria-label="Fermer" onClick={close}>
          <CloseIcon />
        </button>
      </div>

      <fieldset className="field">
        <legend>Période</legend>
        <div className="radio-row">
          <label>
            <input type="radio" name="period" checked={period === 'past'} onChange={() => setPeriod('past')} />
            Déjà sorti
          </label>
          <label>
            <input type="radio" name="period" checked={period === 'next'} onChange={() => setPeriod('next')} />
            À venir
          </label>
        </div>
      </fieldset>

      {addError && <p className="form-error" role="alert">{addError}</p>}

      {manual ? (
        <ManualFilmForm initialTitle={manualTitle} submitLabel="Créer et ajouter" cancelLabel="Retour à la recherche"
          onSaved={(film) => void add(film.id)} onCancel={() => setManual(false)} />
      ) : (
        <div className="dialog-body">
          <div className="field">
            <label htmlFor="add-search">Chercher sur TMDB</label>
            <input id="add-search" type="search" value={query} placeholder="Titre du film" autoComplete="off"
              onChange={(e) => setQuery(e.target.value)} />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {searching && <p className="hint">Recherche…</p>}
          {showNoResult && (
            <div className="no-result">
              <p className="hint">Aucun résultat sur TMDB.</p>
              <button type="button" className="btn btn--primary" onClick={openManual}>
                Créer la fiche « {query.trim()} » à la main
              </button>
            </div>
          )}
          <ul className="search-results">
            {results.map((r) => (
              <li key={r.id}>
                <Poster url={r.posterUrl} title={r.title} small />
                <span>
                  {r.title}
                  {r.year ? ` (${r.year})` : ''}
                </span>
                <button type="button" className="btn" onClick={() => void add(r.id)}>Ajouter</button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--ghost" onClick={openManual}>
            Pas sur TMDB ? Saisir à la main
          </button>
        </div>
      )}
    </dialog>
  );
}
