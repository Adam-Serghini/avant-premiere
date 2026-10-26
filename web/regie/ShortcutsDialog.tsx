import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SHORTCUTS,
  forbiddenReason,
  keyText,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABELS,
  type KeyBinding,
  type ShortcutAction,
  type ShortcutMap,
} from '../../shared/shortcuts';
import { CloseIcon } from '../components/icons';
import { assignKey, canSwap, keyLabel, swapKeys } from './shortcutMap';

interface Props {
  open: boolean;
  map: ShortcutMap;
  onClose(): void;
  /** Enregistre la carte ; renvoie un message d'erreur, ou null si tout s'est bien passé. */
  onSave(map: ShortcutMap): Promise<string | null>;
}

interface Pending {
  action: ShortcutAction;
  binding: KeyBinding;
  conflict: ShortcutAction;
}

export function ShortcutsDialog({ open, map, onClose, onSave }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [capturing, setCapturing] = useState<ShortcutAction | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function save(next: ShortcutMap) {
    setSaving(true);
    setMessage(await onSave(next));
    setSaving(false);
  }

  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      if (e.code === 'Escape') {
        setCapturing(null);
        setMessage(null);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        setMessage('Une seule touche, sans Ctrl, Alt ni Cmd.');
        return;
      }
      const reason = forbiddenReason(e.code);
      if (reason) {
        setMessage(reason);
        return;
      }
      const binding = { code: e.code, label: keyLabel(e.key, e.code) };
      setCapturing(null);
      setMessage(null);
      const result = assignKey(map, capturing, binding);
      if ('conflict' in result) setPending({ action: capturing, binding, conflict: result.conflict });
      else void save(result.map);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [capturing, map]);

  useEffect(() => {
    if (!pending) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') setPending(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pending]);

  function close() {
    setCapturing(null);
    setPending(null);
    setMessage(null);
    onClose();
  }

  return (
    <dialog ref={ref} className="shortcuts-dialog" aria-labelledby="shortcuts-title" onClose={close}
      onCancel={(e) => {
        // Échap pendant la capture ou la question d'échange annule seulement celle-ci.
        if (capturing || pending) e.preventDefault();
        setPending(null);
      }}>
      <div className="dialog-head">
        <h2 id="shortcuts-title">Raccourcis</h2>
        <button type="button" className="icon-btn" aria-label="Fermer" onClick={close}>
          <CloseIcon />
        </button>
      </div>
      <ul className="shortcut-list">
        {SHORTCUT_ACTIONS.map((a) => (
          <li key={a}>
            <span>{SHORTCUT_LABELS[a]}</span>
            {map[a] ? <kbd>{keyText(map[a])}</kbd> : <span className="hint">Aucune touche, à choisir</span>}
            <button type="button" className="btn btn--ghost" aria-pressed={capturing === a} disabled={saving}
              onClick={() => {
                setPending(null);
                setMessage(null);
                setCapturing(a);
              }}>
              Modifier
            </button>
          </li>
        ))}
      </ul>
      {capturing && <p className="hint" aria-live="polite">Appuie sur une touche… (Échap pour annuler)</p>}
      {pending && (
        <div className="shortcut-conflict" role="alert">
          <p>La touche « {pending.binding.label} » sert déjà à {SHORTCUT_LABELS[pending.conflict]}.
            {!canSwap(map, pending.action, pending.conflict) && ` ${SHORTCUT_LABELS[pending.conflict]} doit garder une touche : choisis une autre touche.`}</p>
          <div className="toolbar-actions">
            {canSwap(map, pending.action, pending.conflict) && (
              <button type="button" className="btn"
                onClick={() => {
                  const p = pending;
                  setPending(null);
                  const swapped = swapKeys(map, p.action, p.conflict);
                  if (swapped) void save(swapped);
                }}>
                Échanger
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>Annuler</button>
          </div>
        </div>
      )}
      {message && <p className="form-error" role="alert">{message}</p>}
      <div className="toolbar-actions">
        <button type="button" className="btn btn--ghost" disabled={saving} onClick={() => void save(DEFAULT_SHORTCUTS)}>
          Touches par défaut
        </button>
        <button type="button" className="btn btn--primary" onClick={close}>Fermer</button>
      </div>
    </dialog>
  );
}
