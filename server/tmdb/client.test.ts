import { describe, expect, it, vi } from 'vitest';
import { createTmdbClient, TmdbError } from './client';

function fakeFetch(status: number, body: unknown = {}) {
  return vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
}

function clientWith(fetchFn: unknown, apiKey = 'cle-v3', timeoutMs?: number) {
  return createTmdbClient({ apiKey, fetchFn: fetchFn as typeof fetch, timeoutMs });
}

function calledUrl(fetchFn: ReturnType<typeof fakeFetch>): URL {
  return fetchFn.mock.calls[0]![0] as URL;
}

describe('client TMDB', () => {
  it('cherche les sorties en salles en France sur la période', async () => {
    const fetchFn = fakeFetch(200, { results: [], total_pages: 1 });
    await clientWith(fetchFn).discover({ from: '2026-10-07', to: '2026-10-13' }, 2);
    const url = calledUrl(fetchFn);
    expect(url.pathname).toBe('/3/discover/movie');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      region: 'FR',
      with_release_type: '2|3',
      'release_date.gte': '2026-10-07',
      'release_date.lte': '2026-10-13',
      language: 'fr-FR',
      sort_by: 'popularity.desc',
      page: '2',
      api_key: 'cle-v3',
    });
  });

  it('demande la fiche avec crédits, vidéos et dates de sortie', async () => {
    const fetchFn = fakeFetch(200, { id: 5, title: 'X', poster_path: null });
    await clientWith(fetchFn).details(5);
    const url = calledUrl(fetchFn);
    expect(url.pathname).toBe('/3/movie/5');
    expect(url.searchParams.get('append_to_response')).toBe('credits,videos,release_dates');
    expect(url.searchParams.get('include_video_language')).toBe('fr,en,null');
  });

  it('utilise l’en-tête Bearer pour un jeton v4', async () => {
    const fetchFn = fakeFetch(200, { results: [], total_pages: 1 });
    await clientWith(fetchFn, 'eyJjeton').search('samourai');
    const init = fetchFn.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer eyJjeton');
    expect(calledUrl(fetchFn).searchParams.has('api_key')).toBe(false);
  });

  it('distingue clé refusée, introuvable et indisponible', async () => {
    await expect(clientWith(fakeFetch(401)).details(1)).rejects.toMatchObject({ kind: 'auth' });
    await expect(clientWith(fakeFetch(404)).details(1)).rejects.toMatchObject({ kind: 'not_found' });
    await expect(clientWith(fakeFetch(500)).details(1)).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('signale TMDB indisponible si le réseau échoue', async () => {
    const failing = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(clientWith(failing).details(1)).rejects.toBeInstanceOf(TmdbError);
  });

  it('abandonne après le délai maximal', async () => {
    const hanging = (_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      });
    await expect(clientWith(hanging, 'k', 20).details(1)).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('signale TMDB indisponible si la réponse n’est pas du JSON', async () => {
    const bad = async () => new Response('pas du json', { status: 200 });
    await expect(clientWith(bad).details(1)).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('vérifie la clé', async () => {
    expect(await clientWith(fakeFetch(200)).checkKey()).toBe('ok');
    expect(await clientWith(fakeFetch(401)).checkKey()).toBe('invalid');
    expect(await clientWith(fakeFetch(503)).checkKey()).toBe('unavailable');
  });
});
