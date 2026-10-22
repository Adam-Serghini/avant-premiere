import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisplayMode, LiveAction, LiveSnapshot } from '../../shared/types';
import { effectiveTrailerKey } from '../../shared/trailer';
import { api, errorMessage } from '../api';
import { AppHeader } from '../components/AppHeader';
import { Grain } from '../components/Grain';
import { ChevronLeft, ChevronRight } from '../components/icons';
import { Poster } from '../components/Poster';
import { formatRuntime, readDateParam, releaseKicker, yearOf } from '../format';
import { useLiveSnapshot } from '../live/useLiveSnapshot';
import { OverlayPreview } from './OverlayPreview';
import { PrivateNotes } from './PrivateNotes';
import { useShortcuts } from './shortcuts';
import './regie.css';

const MODES: { mode: DisplayMode; label: string; key: string }[] = [
  { mode: 'full', label: 'Fiche', key: '1' },
  { mode: 'trailer', label: 'Bande-annonce', key: '2' },
  { mode: 'off', label: 'Masquer', key: '3' },
];

export function RegiePage() {
  const { snapshot, connected } = useLiveSnapshot('other');
  const [airDate, setAirDate] = useState<string | null>(() => readDateParam(window.location.search));
  const [error, setError] = useState<string | null>(null);
  const resumed = useRef<string | null>(null);

  const send = useCallback((action: LiveAction) => {
    api.liveAction(action).then(
      () => setError(null),
      (e: unknown) => setError(errorMessage(e)),
    );
  }, []);

  useEffect(() => {
    if (airDate) {
      window.history.replaceState(null, '', '/regie?date=' + airDate);
      if (resumed.current === airDate) return;
      send({ type: 'start', airDate });
      return;
    }
    let cancelled = false;
    // Sans date : on reprend le live en cours s'il y a des films, sinon on prend la date du jour.
    api
      .live()
      .then((s) => {
        if (s.state.airDate && s.total > 0) {
          resumed.current = s.state.airDate;
          return s.state.airDate;
        }
        return api.today().then((t) => t.airDate);
      })
      .then(
        (d) => {
          if (!cancelled) setAirDate(d);
        },
        (e: unknown) => {
          if (!cancelled) setError(errorMessage(e));
        },
      );
    return () => {
      cancelled = true;
    };
  }, [airDate, send]);

  useShortcuts(send);

  const obsOk = snapshot?.overlayConnected ?? false;

  return (
    <>
      <AppHeader current="regie" airDate={airDate}>
        <span className="live-pill">En direct</span>
        <span className={`status-dot ${obsOk ? 'is-ok' : 'is-bad'}`}>{obsOk ? 'OBS connecté' : 'OBS déconnecté'}</span>
        {!connected && <span className="status-dot is-bad">Serveur injoignable</span>}
      </AppHeader>
      {error && <div className="banner" role="alert">{error}</div>}
      <main className="regie-main">
        {!snapshot ? (
          <p className="hint">Connexion au serveur…</p>
        ) : snapshot.total === 0 ? (
          <p className="empty">
            Aucun film au programme pour cette émission. <a href={`/?date=${airDate ?? ''}`}>Prépare-la d’abord</a>.
          </p>
        ) : (
          <LiveBoard snapshot={snapshot} send={send} />
        )}
      </main>
      <Grain variant="page" />
    </>
  );
}

function LiveBoard({ snapshot, send }: { snapshot: LiveSnapshot; send: (a: LiveAction) => void }) {
  const { state, total, rundown, current } = snapshot;
  const hasTrailer = current !== null && effectiveTrailerKey(current) !== null;

  return (
    <>
      <ol className="steps" aria-label="Conducteur">
        {rundown.map((r, i) => (
          <li key={r.filmId}>
            <button type="button" className={i < state.position ? 'is-done' : undefined}
              aria-current={i === state.position ? 'step' : undefined}
              onClick={() => send({ type: 'goto', position: i })}>
              <span className="n">{i + 1}</span>
              {r.title}
            </button>
          </li>
        ))}
      </ol>

      <div className="regie-body">
        {current && (
          <section className="panel on-air" aria-label="Film à l’antenne">
            <div className="panel-inner">
              <Poster url={current.film.posterUrl} title={current.film.title} />
              <div className="on-air-info">
                <span className="label kicker">
                  Film {state.position + 1} sur {total} · {releaseKicker(current.period, current.film.releaseDateFr)}
                </span>
                <h1>{current.film.title}</h1>
                <p className="hint">
                  {[current.film.genres.slice(0, 2).join(', '), yearOf(current.film.releaseDateFr), formatRuntime(current.film.runtimeMin)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {current.film.directors.length > 0 && <p className="hint">De {current.film.directors.join(', ')}</p>}
                {current.film.cast.length > 0 && <p className="hint">Avec {current.film.cast.join(', ')}</p>}
                <PrivateNotes ef={current} />
              </div>
            </div>
          </section>
        )}

        <section className="controls" aria-label="Antenne">
          <span className="label hint">Aperçu de ce que voit le chat</span>
          <OverlayPreview />
          <div className="modes" role="group" aria-label="Mode d’affichage">
            {MODES.map((m) => (
              <button key={m.mode} type="button" className="btn" aria-pressed={state.mode === m.mode}
                disabled={m.mode === 'trailer' && !hasTrailer}
                onClick={() => send({ type: 'setMode', mode: m.mode })}>
                {m.label} <kbd>{m.key}</kbd>
              </button>
            ))}
          </div>
          {!hasTrailer && <p className="hint">Aucune bande-annonce trouvée pour ce film.</p>}
          <div className="nav-buttons">
            <button type="button" className="btn btn--ghost" disabled={state.position === 0}
              onClick={() => send({ type: 'prev' })}>
              <ChevronLeft /> Précédent
            </button>
            <button type="button" className="btn btn--primary" disabled={state.position >= total - 1}
              onClick={() => send({ type: 'next' })}>
              Film suivant <ChevronRight />
            </button>
          </div>
          <p className="hint">
            Raccourcis : <kbd>←</kbd> <kbd>→</kbd> pour changer de film, <kbd>1</kbd> à <kbd>3</kbd> pour l’affichage.
          </p>
        </section>
      </div>
    </>
  );
}
