import { useEffect } from 'react';
import { effectiveTrailerKey } from '../../shared/trailer';
import { useLiveSnapshot } from '../live/useLiveSnapshot';
import { CardView } from './CardView';
import { FullView } from './FullView';
import { TrailerView } from './TrailerView';
import './overlay.css';

const preview = new URLSearchParams(window.location.search).has('preview');

export function OverlayPage() {
  const { snapshot } = useLiveSnapshot(preview ? 'other' : 'overlay');

  useEffect(() => {
    document.body.classList.add('is-overlay');
    return () => document.body.classList.remove('is-overlay');
  }, []);

  // Si le flux coupe, `snapshot` garde la dernière valeur : l'affichage reste en place.
  if (!snapshot?.current || snapshot.state.mode === 'off') return null;

  const { current, state, total } = snapshot;
  const trailerKey = effectiveTrailerKey(current);
  const key = `${current.film.id}-${state.mode}`;

  return (
    <div className="overlay-stage" key={key}>
      {state.mode === 'card' && <CardView ef={current} position={state.position} total={total} />}
      {state.mode === 'full' && <FullView ef={current} position={state.position} total={total} />}
      {state.mode === 'trailer' && trailerKey && <TrailerView videoId={trailerKey} preview={preview} />}
    </div>
  );
}
