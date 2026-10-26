import { useEffect } from 'react';
import { effectiveTrailer } from '../../shared/trailer';
import { useLiveSnapshot } from '../live/useLiveSnapshot';
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
  const trailer = effectiveTrailer(current);
  const key = `${current.film.id}-${state.mode}`;

  return (
    <div className="overlay-stage" key={key}>
      {state.mode === 'full' && <FullView ef={current} airDate={state.airDate} position={state.position} total={total} />}
      {state.mode === 'trailer' && trailer && <TrailerView trailer={trailer} preview={preview} />}
    </div>
  );
}
