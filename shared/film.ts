import type { Film } from './types';

export function displayPoster(film: Film): string | null {
  return film.customPosterUrl ?? film.posterUrl;
}
