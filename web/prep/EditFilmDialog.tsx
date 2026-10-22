import { useEffect, useRef } from 'react';
import type { Film } from '../../shared/types';
import { CloseIcon } from '../components/icons';
import { ManualFilmForm } from './ManualFilmForm';

interface Props {
  film: Film | null;
  onClose(): void;
  onSaved(): void;
}

export function EditFilmDialog({ film, onClose, onSaved }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (film && !dialog.open) dialog.showModal();
    if (!film && dialog.open) dialog.close();
  }, [film]);

  return (
    <dialog ref={ref} className="add-dialog" onClose={onClose} aria-labelledby="edit-title">
      <div className="dialog-head">
        <h2 id="edit-title">Modifier la fiche</h2>
        <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      {film && (
        <ManualFilmForm key={film.id} initial={film} submitLabel="Enregistrer" cancelLabel="Annuler" onCancel={onClose}
          onSaved={() => {
            onSaved();
            onClose();
          }} />
      )}
    </dialog>
  );
}
