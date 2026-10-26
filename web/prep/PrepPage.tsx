import type { Section } from '../../shared/sections';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Emission, EmissionFilm, Releases, ReleaseSummary } from '../../shared/types';
import { hasPrivateContent } from '../../shared/notes';
import { api, errorMessage } from '../api';
import { AppHeader } from '../components/AppHeader';
import { Grain } from '../components/Grain';
import { formatAirDate, formatDateFr, readDateParam } from '../format';
import { AddFilmDialog } from './AddFilmDialog';
import { FilmSheet } from './FilmSheet';
import { ReleaseGrid } from './ReleaseGrid';
import { Rundown } from './Rundown';
import './prep.css';

export function PrepPage() {
  const [airDate, setAirDate] = useState<string | null>(() => readDateParam(window.location.search));
  const [releases, setReleases] = useState<Releases | null>(null);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [emission, setEmission] = useState<Emission | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [releasesError, setReleasesError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Date actuellement affichée : sert à ignorer les réponses tardives d'une date précédente.
  const airDateRef = useRef<string | null>(airDate);
  airDateRef.current = airDate;

  const report = useCallback((e: unknown) => setActionError(errorMessage(e)), []);

  useEffect(() => {
    if (airDate) return;
    api.today().then((t) => setAirDate(t.airDate), report);
  }, [airDate, report]);

  const loadReleases = useCallback(
    async (date: string) => {
      setLoadingReleases(true);
      try {
        const r = await api.releases(date);
        if (airDateRef.current !== date) return;
        setReleases(r);
        setReleasesError(null);
      } catch (e) {
        if (airDateRef.current !== date) return;
        setReleasesError(errorMessage(e));
      } finally {
        if (airDateRef.current === date) setLoadingReleases(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!airDate) return;
    window.history.replaceState(null, '', `/?date=${airDate}`);
    setReleases(null);
    setEmission(null);
    setReleasesError(null);
    let cancelled = false;
    api.emission(airDate).then((e) => {
      if (cancelled) return;
      setEmission(e);
      setActiveId(e.films[0]?.film.id ?? null);
    }, (e: unknown) => {
      if (!cancelled) report(e);
    });
    void loadReleases(airDate);
    return () => {
      cancelled = true;
    };
  }, [airDate, loadReleases, report]);

  // N'accepte une émission renvoyée par le serveur que si c'est celle affichée
  // (un enregistrement automatique peut répondre après un changement de date).
  const acceptEmission = useCallback((next: Emission) => {
    if (next.airDate !== airDateRef.current) return;
    setEmission((cur) => (cur === null || cur.id === next.id ? next : cur));
  }, []);

  if (!airDate) {
    return (
      <>
        <AppHeader current="prep" airDate={null} />
        {actionError && <div className="banner" role="alert">{actionError}</div>}
        <main className="prep-main"><p className="hint">Chargement…</p></main>
      </>
    );
  }

  const date: string = airDate;
  const films = emission?.films ?? [];
  const selected = new Set(films.map((f) => f.film.id));
  const active = films.find((f) => f.film.id === activeId) ?? films[0] ?? null;

  async function mutate(fn: () => Promise<Emission>): Promise<boolean> {
    try {
      acceptEmission(await fn());
      setActionError(null);
      return true;
    } catch (e) {
      report(e);
      return false;
    }
  }

  async function removeFilm(ef: EmissionFilm) {
    const hasNotes = hasPrivateContent(ef);
    if (hasNotes && !window.confirm(`Retirer « ${ef.film.title} » du live ? Tes notes sur ce film seront perdues.`)) {
      return;
    }
    await mutate(() => api.removeFilm(date, ef.film.id));
  }

  async function toggle(film: ReleaseSummary, section: Section, checked: boolean) {
    if (checked) {
      if (await mutate(() => api.addFilm(date, film.id, section))) setActiveId(film.id);
      return;
    }
    const ef = films.find((f) => f.film.id === film.id);
    if (ef) await removeFilm(ef);
  }

  function move(filmId: string, delta: -1 | 1) {
    const ids = films.map((f) => f.film.id);
    const i = ids.indexOf(filmId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    void mutate(() => api.reorder(date, ids));
  }

  async function refreshOne(filmId: string) {
    await mutate(async () => {
      await api.refreshFilm(filmId);
      return api.emission(date);
    });
  }

  async function refreshAll() {
    await loadReleases(date);
    await mutate(async () => {
      for (const ef of films) if (ef.film.source === 'tmdb') await api.refreshFilm(ef.film.id);
      return api.emission(date);
    });
  }

  async function addFromDialog(filmId: string, section: Section): Promise<string | null> {
    try {
      acceptEmission(await api.addFilm(date, filmId, section));
      setActionError(null);
      setActiveId(filmId);
      return null;
    } catch (e) {
      return errorMessage(e);
    }
  }

  return (
    <>
      <AppHeader current="prep" airDate={date}>
        <span className="label header-sub">Émission du {formatAirDate(date)}</span>
      </AppHeader>
      {releasesError && <div className="banner" role="alert">{releasesError}</div>}
      {actionError && <div className="banner" role="alert">{actionError}</div>}

      <main className="prep-main">
        <section className="prep-releases" aria-label="Sorties">
          <div className="toolbar">
            <h1>Les sorties</h1>
            <div className="toolbar-actions">
              <div className="date-field">
                <label htmlFor="air-date">Date de l’émission</label>
                <input id="air-date" type="date" value={date}
                  onChange={(e) => readDateParam(`?date=${e.target.value}`) && setAirDate(e.target.value)} />
              </div>
              <button type="button" className="btn" disabled={loadingReleases} onClick={() => void refreshAll()}>
                Actualiser
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
                Ajouter un film
              </button>
            </div>
          </div>

          <ReleaseGrid
            heading={releases ? `Sortis du ${formatDateFr(releases.past.from)} au ${formatDateFr(releases.past.to)}` : 'Déjà sortis'}
            films={releases?.past.films ?? null}
            loading={loadingReleases}
            selected={selected}
            onToggle={(f, checked) => void toggle(f, 'seen', checked)}
          />
          <ReleaseGrid
            heading={releases ? `Sortent du ${formatDateFr(releases.next.from)} au ${formatDateFr(releases.next.to)}` : 'À venir'}
            films={releases?.next.films ?? null}
            loading={loadingReleases}
            selected={selected}
            onToggle={(f, checked) => void toggle(f, 'releases', checked)}
          />
        </section>

        <aside className="prep-side">
          <section className="panel" aria-labelledby="rundown-title">
            <div className="panel-inner">
              <div className="panel-head">
                <h2 id="rundown-title">Conducteur</h2>
                <span className="label count">{films.length} au programme</span>
              </div>
              {films.length === 0 ? (
                <p className="empty">Coche des films pour construire ton live.</p>
              ) : (
                <Rundown films={films} activeId={active?.film.id ?? null} onSelect={setActiveId} onMove={move} />
              )}
            </div>
          </section>
          {active && (
            <FilmSheet
              key={`${date}-${active.film.id}`}
              airDate={date}
              ef={active}
              onSaved={acceptEmission}
              onRemove={() => void removeFilm(active)}
              onRefresh={() => void refreshOne(active.film.id)}
              onFilmChanged={() => void mutate(() => api.emission(date))}
              onError={report}
            />
          )}
        </aside>
      </main>

      <footer className="prep-footer">Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.</footer>
      <AddFilmDialog open={adding} onClose={() => setAdding(false)} onAdd={addFromDialog} />
      <Grain variant="page" />
    </>
  );
}
