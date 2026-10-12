import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api';

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'error';

const RETRY_MS = 2000;

export interface AutosaveState {
  status: SaveStatus;
  /** Message du serveur quand l'erreur est définitive (4xx) ; null si on réessaie. */
  errorMessage: string | null;
}

/**
 * Enregistre `value` après `delayMs` sans modification. Au démontage (changement de film,
 * fermeture de l'onglet), une modification encore en attente est envoyée tout de suite.
 */
export function useAutosave<T>(value: T, save: (v: T) => Promise<void>, delayMs = 500): AutosaveState {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const latest = useRef(value);
  const saveRef = useRef(save);
  saveRef.current = save;
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const first = useRef(true);
  const mounted = useRef(true);
  const inflight = useRef(false);
  const again = useRef(false);

  const flush = useCallback(async (): Promise<void> => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    if (inflight.current) {
      again.current = true;
      return;
    }
    inflight.current = true;
    dirty.current = false;
    try {
      await saveRef.current(latest.current);
      if (mounted.current && !dirty.current) {
        setStatus('saved');
        setErrorMessage(null);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        // Refus définitif du serveur : inutile de réessayer la même requête.
        if (mounted.current) {
          setStatus('error');
          setErrorMessage(e.message);
        }
      } else {
        dirty.current = true;
        if (mounted.current) {
          setStatus('error');
          setErrorMessage(null);
        }
        timer.current = setTimeout(() => void flush(), RETRY_MS);
      }
    } finally {
      inflight.current = false;
      if (again.current) {
        again.current = false;
        void flush();
      }
    }
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    latest.current = value;
    dirty.current = true;
    setStatus('pending');
    setErrorMessage(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delayMs);
  }, [value, delayMs, flush]);

  useEffect(() => {
    mounted.current = true;
    const onUnload = () => void flush();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      mounted.current = false;
      window.removeEventListener('beforeunload', onUnload);
      void flush();
    };
  }, [flush]);

  return { status, errorMessage };
}
