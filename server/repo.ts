import type { DisplayMode, Emission, EmissionFilm, EmissionFilmPatch, Film, LiveState, Period } from '../shared/types';
import { defaultTrailerKey } from '../shared/trailer';
import type { Db } from './db';

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
  getEmission(airDate: string): Emission;
  getEmissionById(id: number): Emission | null;
  addFilm(airDate: string, filmId: string, period: Period): Emission;
  removeFilm(airDate: string, filmId: string): Emission;
  updateFilm(airDate: string, filmId: string, patch: EmissionFilmPatch): Emission;
  reorder(airDate: string, filmIds: string[]): Emission;
  getLiveState(): LiveState;
  saveLiveState(state: LiveState): void;
}

interface FilmRow {
  id: string;
  source: Film['source'];
  title: string;
  original_title: string | null;
  release_date_fr: string | null;
  poster_url: string | null;
  directors: string;
  cast_members: string;
  genres: string;
  runtime_min: number | null;
  synopsis: string | null;
  trailers: string;
  fetched_at: string | null;
}

interface EmissionFilmRow extends FilmRow {
  emission_id: number;
  film_id: string;
  position: number;
  period: Period;
  notes: string;
  score: number | null;
  trailer_key: string | null;
}

interface LiveRow {
  emission_id: number | null;
  current_position: number;
  mode: DisplayMode;
  air_date: string | null;
}

function filmFromRow(r: FilmRow): Film {
  return {
    id: r.id,
    source: r.source,
    title: r.title,
    originalTitle: r.original_title,
    releaseDateFr: r.release_date_fr,
    posterUrl: r.poster_url,
    directors: JSON.parse(r.directors) as string[],
    cast: JSON.parse(r.cast_members) as string[],
    genres: JSON.parse(r.genres) as string[],
    runtimeMin: r.runtime_min,
    synopsis: r.synopsis,
    trailers: JSON.parse(r.trailers) as Film['trailers'],
    fetchedAt: r.fetched_at,
  };
}

function emissionFilmFromRow(r: EmissionFilmRow): EmissionFilm {
  return {
    film: filmFromRow(r),
    position: r.position,
    period: r.period,
    notes: r.notes,
    score: r.score,
    trailerKey: r.trailer_key,
  };
}

export function createRepo(db: Db): Repo {
  const q = {
    upsertFilm: db.prepare(`
      INSERT INTO films (id, source, title, original_title, release_date_fr, poster_url, directors, cast_members, genres, runtime_min, synopsis, trailers, fetched_at)
      VALUES (@id, @source, @title, @original_title, @release_date_fr, @poster_url, @directors, @cast_members, @genres, @runtime_min, @synopsis, @trailers, @fetched_at)
      ON CONFLICT(id) DO UPDATE SET
        source = excluded.source, title = excluded.title, original_title = excluded.original_title,
        release_date_fr = excluded.release_date_fr, poster_url = excluded.poster_url, directors = excluded.directors,
        cast_members = excluded.cast_members, genres = excluded.genres, runtime_min = excluded.runtime_min,
        synopsis = excluded.synopsis, trailers = excluded.trailers, fetched_at = excluded.fetched_at`),
    getFilm: db.prepare('SELECT * FROM films WHERE id = ?'),
    insertEmission: db.prepare('INSERT OR IGNORE INTO emissions (air_date, created_at) VALUES (?, ?)'),
    emissionByDate: db.prepare('SELECT id FROM emissions WHERE air_date = ?'),
    emissionById: db.prepare('SELECT id, air_date FROM emissions WHERE id = ?'),
    emissionFilms: db.prepare(
      'SELECT * FROM emission_films ef JOIN films f ON f.id = ef.film_id WHERE ef.emission_id = ? ORDER BY ef.position',
    ),
    efRow: db.prepare('SELECT * FROM emission_films WHERE emission_id = ? AND film_id = ?'),
    countFilms: db.prepare('SELECT COUNT(*) AS n FROM emission_films WHERE emission_id = ?'),
    insertEf: db.prepare(
      "INSERT INTO emission_films (emission_id, film_id, position, period, notes, score, trailer_key) VALUES (?, ?, ?, ?, '', NULL, ?)",
    ),
    deleteEf: db.prepare('DELETE FROM emission_films WHERE emission_id = ? AND film_id = ?'),
    updateEf: db.prepare(
      'UPDATE emission_films SET notes = ?, score = ?, trailer_key = ? WHERE emission_id = ? AND film_id = ?',
    ),
    setPosition: db.prepare('UPDATE emission_films SET position = ? WHERE emission_id = ? AND film_id = ?'),
    orderedIds: db.prepare('SELECT film_id FROM emission_films WHERE emission_id = ? ORDER BY position'),
    getLive: db.prepare(
      'SELECT ls.emission_id, ls.current_position, ls.mode, e.air_date FROM live_state ls LEFT JOIN emissions e ON e.id = ls.emission_id WHERE ls.id = 1',
    ),
    saveLive: db.prepare('UPDATE live_state SET emission_id = ?, current_position = ?, mode = ? WHERE id = 1'),
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
    const notes = patch.notes === undefined ? row.notes : patch.notes;
    const trailerKey = patch.trailerKey === undefined ? row.trailer_key : patch.trailerKey;
    q.updateEf.run(notes, score, trailerKey, id, filmId);
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
      });
    },
    getFilm(id) {
      const row = q.getFilm.get(id) as FilmRow | undefined;
      return row ? filmFromRow(row) : null;
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
  };
}
