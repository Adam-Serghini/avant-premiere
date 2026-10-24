import type { DisplayMode, Emission, EmissionFilm, EmissionFilmPatch, Film, FilmOverrides, LiveState, Period, Ratings } from '../shared/types';
import { defaultTrailerKey, selectTrailers } from '../shared/trailer';
import type { Db } from './db';
import { applyOverrides, diffOverrides, parseOverrides } from './overrides';
import type { MediaKind } from './media';

export class RepoError extends Error {
  constructor(
    public readonly code: 'not_found' | 'invalid',
    message: string,
  ) {
    super(message);
    this.name = 'RepoError';
  }
}

export interface Repo {
  upsertFilm(film: Film): void;
  getFilm(id: string): Film | null;
  setFilmMedia(filmId: string, kind: MediaKind, url: string | null): Film;
  /** Enregistre les corrections qui diffèrent des infos de base ; les valeurs identiques à la base sont abandonnées. */
  editFilm(filmId: string, candidate: FilmOverrides): Film;
  clearFilmOverrides(filmId: string): Film;
  /** Notes OMDb ; jamais écrites par `upsertFilm`, pour qu’une actualisation TMDB ne les efface pas. */
  setFilmRatings(filmId: string, ratings: Ratings | null): void;
  getEmission(airDate: string): Emission;
  getEmissionById(id: number): Emission | null;
  addFilm(airDate: string, filmId: string, period: Period): Emission;
  removeFilm(airDate: string, filmId: string): Emission;
  updateFilm(airDate: string, filmId: string, patch: EmissionFilmPatch): Emission;
  reorder(airDate: string, filmIds: string[]): Emission;
  getLiveState(): LiveState;
  saveLiveState(state: LiveState): void;
  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;
}

interface FilmRow {
  id: string;
  source: Film['source'];
  title: string;
  original_title: string | null;
  release_date_fr: string | null;
  poster_url: string | null;
  custom_poster: string | null;
  local_trailer: string | null;
  directors: string;
  cast_members: string;
  genres: string;
  runtime_min: number | null;
  synopsis: string | null;
  trailers: string;
  fetched_at: string | null;
  overrides: string;
  imdb_id: string | null;
  ratings: string | null;
}

interface EmissionFilmRow extends FilmRow {
  emission_id: number;
  film_id: string;
  position: number;
  period: Period;
  opinion: string;
  anecdotes: string;
  extended_universe: string;
  score: number | null;
  trailer_key: string | null;
}

interface LiveRow {
  emission_id: number | null;
  current_position: number;
  mode: DisplayMode;
  air_date: string | null;
}

function parseRatings(raw: string | null): Ratings | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof Ratings, unknown>> | null;
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
    return { imdb: num(v.imdb), rottenTomatoes: num(v.rottenTomatoes), metacritic: num(v.metacritic) };
  } catch {
    return null;
  }
}

function baseFilmFromRow(r: FilmRow): Film {
  return {
    id: r.id,
    source: r.source,
    title: r.title,
    originalTitle: r.original_title,
    releaseDateFr: r.release_date_fr,
    posterUrl: r.poster_url,
    customPosterUrl: r.custom_poster,
    localTrailerUrl: r.local_trailer,
    directors: JSON.parse(r.directors) as string[],
    cast: JSON.parse(r.cast_members) as string[],
    genres: JSON.parse(r.genres) as string[],
    runtimeMin: r.runtime_min,
    synopsis: r.synopsis,
    // Tri à la lecture : les fiches déjà enregistrées en profitent sans actualisation.
    trailers: selectTrailers(JSON.parse(r.trailers) as Film['trailers']),
    fetchedAt: r.fetched_at,
    editedFields: [],
    imdbId: r.imdb_id,
    ratings: parseRatings(r.ratings),
  };
}

function filmFromRow(r: FilmRow): Film {
  return applyOverrides(baseFilmFromRow(r), parseOverrides(r.overrides));
}

function emissionFilmFromRow(r: EmissionFilmRow): EmissionFilm {
  return {
    film: filmFromRow(r),
    position: r.position,
    period: r.period,
    opinion: r.opinion,
    anecdotes: r.anecdotes,
    extendedUniverse: r.extended_universe,
    score: r.score,
    trailerKey: r.trailer_key,
  };
}

export function createRepo(db: Db): Repo {
  const q = {
    upsertFilm: db.prepare(`
      INSERT INTO films (id, source, title, original_title, release_date_fr, poster_url, directors, cast_members, genres, runtime_min, synopsis, trailers, fetched_at, imdb_id)
      VALUES (@id, @source, @title, @original_title, @release_date_fr, @poster_url, @directors, @cast_members, @genres, @runtime_min, @synopsis, @trailers, @fetched_at, @imdb_id)
      ON CONFLICT(id) DO UPDATE SET
        source = excluded.source, title = excluded.title, original_title = excluded.original_title,
        release_date_fr = excluded.release_date_fr, poster_url = excluded.poster_url, directors = excluded.directors,
        cast_members = excluded.cast_members, genres = excluded.genres, runtime_min = excluded.runtime_min,
        synopsis = excluded.synopsis, trailers = excluded.trailers, fetched_at = excluded.fetched_at,
        imdb_id = excluded.imdb_id`),
    getFilm: db.prepare('SELECT * FROM films WHERE id = ?'),
    setPoster: db.prepare('UPDATE films SET custom_poster = ? WHERE id = ?'),
    setTrailer: db.prepare('UPDATE films SET local_trailer = ? WHERE id = ?'),
    setOverrides: db.prepare('UPDATE films SET overrides = ? WHERE id = ?'),
    setRatings: db.prepare('UPDATE films SET ratings = ? WHERE id = ?'),
    insertEmission: db.prepare('INSERT OR IGNORE INTO emissions (air_date, created_at) VALUES (?, ?)'),
    emissionByDate: db.prepare('SELECT id FROM emissions WHERE air_date = ?'),
    emissionById: db.prepare('SELECT id, air_date FROM emissions WHERE id = ?'),
    emissionFilms: db.prepare(
      'SELECT * FROM emission_films ef JOIN films f ON f.id = ef.film_id WHERE ef.emission_id = ? ORDER BY ef.position',
    ),
    efRow: db.prepare('SELECT * FROM emission_films WHERE emission_id = ? AND film_id = ?'),
    countFilms: db.prepare('SELECT COUNT(*) AS n FROM emission_films WHERE emission_id = ?'),
    insertEf: db.prepare(
      'INSERT INTO emission_films (emission_id, film_id, position, period, score, trailer_key) VALUES (?, ?, ?, ?, NULL, ?)',
    ),
    deleteEf: db.prepare('DELETE FROM emission_films WHERE emission_id = ? AND film_id = ?'),
    updateEf: db.prepare(
      'UPDATE emission_films SET opinion = ?, anecdotes = ?, extended_universe = ?, score = ?, trailer_key = ? WHERE emission_id = ? AND film_id = ?',
    ),
    setPosition: db.prepare('UPDATE emission_films SET position = ? WHERE emission_id = ? AND film_id = ?'),
    orderedIds: db.prepare('SELECT film_id FROM emission_films WHERE emission_id = ? ORDER BY position'),
    getLive: db.prepare(
      'SELECT ls.emission_id, ls.current_position, ls.mode, e.air_date FROM live_state ls LEFT JOIN emissions e ON e.id = ls.emission_id WHERE ls.id = 1',
    ),
    saveLive: db.prepare('UPDATE live_state SET emission_id = ?, current_position = ?, mode = ? WHERE id = 1'),
    getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ),
  };

  function emissionId(airDate: string): number {
    q.insertEmission.run(airDate, new Date().toISOString());
    return (q.emissionByDate.get(airDate) as { id: number }).id;
  }

  function load(id: number): Emission | null {
    const e = q.emissionById.get(id) as { id: number; air_date: string } | undefined;
    if (!e) return null;
    const rows = q.emissionFilms.all(id) as EmissionFilmRow[];
    return { id: e.id, airDate: e.air_date, films: rows.map(emissionFilmFromRow) };
  }

  function orderedIds(id: number): string[] {
    return (q.orderedIds.all(id) as { film_id: string }[]).map((r) => r.film_id);
  }

  function renumber(id: number, filmIds: string[]): void {
    filmIds.forEach((filmId, i) => q.setPosition.run(i, id, filmId));
  }

  const addFilm = db.transaction((airDate: string, filmId: string, period: Period): Emission => {
    const id = emissionId(airDate);
    if (!q.efRow.get(id, filmId)) {
      const row = q.getFilm.get(filmId) as FilmRow | undefined;
      if (!row) throw new RepoError('not_found', 'Film inconnu.');
      const { n } = q.countFilms.get(id) as { n: number };
      q.insertEf.run(id, filmId, n, period, defaultTrailerKey(filmFromRow(row).trailers));
    }
    return load(id)!;
  });

  const removeFilm = db.transaction((airDate: string, filmId: string): Emission => {
    const id = emissionId(airDate);
    q.deleteEf.run(id, filmId);
    renumber(id, orderedIds(id));
    return load(id)!;
  });

  const updateFilm = db.transaction((airDate: string, filmId: string, patch: EmissionFilmPatch): Emission => {
    const id = emissionId(airDate);
    const row = q.efRow.get(id, filmId) as EmissionFilmRow | undefined;
    if (!row) throw new RepoError('not_found', 'Ce film n’est pas dans l’émission.');
    const score = patch.score === undefined ? row.score : patch.score;
    if (score !== null && !(Number.isInteger(score) && score >= 0 && score <= 10)) {
      throw new RepoError('invalid', 'La note doit être un nombre entier entre 0 et 10.');
    }
    const opinion = patch.opinion ?? row.opinion;
    const anecdotes = patch.anecdotes ?? row.anecdotes;
    const extendedUniverse = patch.extendedUniverse ?? row.extended_universe;
    const trailerKey = patch.trailerKey === undefined ? row.trailer_key : patch.trailerKey;
    q.updateEf.run(opinion, anecdotes, extendedUniverse, score, trailerKey, id, filmId);
    return load(id)!;
  });

  const reorder = db.transaction((airDate: string, filmIds: string[]): Emission => {
    const id = emissionId(airDate);
    const current = new Set(orderedIds(id));
    const valid =
      filmIds.length === current.size &&
      new Set(filmIds).size === filmIds.length &&
      filmIds.every((f) => current.has(f));
    if (!valid) throw new RepoError('invalid', 'Le nouvel ordre doit contenir exactement les films retenus.');
    renumber(id, filmIds);
    return load(id)!;
  });

  return {
    upsertFilm(film) {
      q.upsertFilm.run({
        id: film.id,
        source: film.source,
        title: film.title,
        original_title: film.originalTitle,
        release_date_fr: film.releaseDateFr,
        poster_url: film.posterUrl,
        directors: JSON.stringify(film.directors),
        cast_members: JSON.stringify(film.cast),
        genres: JSON.stringify(film.genres),
        runtime_min: film.runtimeMin,
        synopsis: film.synopsis,
        trailers: JSON.stringify(film.trailers),
        fetched_at: film.fetchedAt,
        imdb_id: film.imdbId,
      });
    },
    setFilmRatings(filmId, ratings) {
      if (q.setRatings.run(ratings && JSON.stringify(ratings), filmId).changes === 0) {
        throw new RepoError('not_found', 'Film inconnu.');
      }
    },
    getFilm(id) {
      const row = q.getFilm.get(id) as FilmRow | undefined;
      return row ? filmFromRow(row) : null;
    },
    setFilmMedia(filmId, kind, url) {
      const result = (kind === 'poster' ? q.setPoster : q.setTrailer).run(url, filmId);
      if (result.changes === 0) throw new RepoError('not_found', 'Film inconnu.');
      return filmFromRow(q.getFilm.get(filmId) as FilmRow);
    },
    editFilm(filmId, candidate) {
      const row = q.getFilm.get(filmId) as FilmRow | undefined;
      if (!row) throw new RepoError('not_found', 'Film inconnu.');
      q.setOverrides.run(JSON.stringify(diffOverrides(baseFilmFromRow(row), candidate)), filmId);
      return filmFromRow(q.getFilm.get(filmId) as FilmRow);
    },
    clearFilmOverrides(filmId) {
      if (q.setOverrides.run('{}', filmId).changes === 0) throw new RepoError('not_found', 'Film inconnu.');
      return filmFromRow(q.getFilm.get(filmId) as FilmRow);
    },
    getEmission: (airDate) => load(emissionId(airDate))!,
    getEmissionById: (id) => load(id),
    addFilm: (airDate, filmId, period) => addFilm(airDate, filmId, period),
    removeFilm: (airDate, filmId) => removeFilm(airDate, filmId),
    updateFilm: (airDate, filmId, patch) => updateFilm(airDate, filmId, patch),
    reorder: (airDate, filmIds) => reorder(airDate, filmIds),
    getLiveState() {
      const r = q.getLive.get() as LiveRow;
      return { emissionId: r.emission_id, airDate: r.air_date, position: r.current_position, mode: r.mode };
    },
    saveLiveState(s) {
      q.saveLive.run(s.emissionId, s.position, s.mode);
    },
    getSetting(key) {
      return (q.getSetting.get(key) as { value: string } | undefined)?.value ?? null;
    },
    setSetting(key, value) {
      q.setSetting.run(key, value);
    },
  };
}
