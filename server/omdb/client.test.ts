import { describe, expect, it, vi } from 'vitest';
import { createOmdbClient, OmdbError, parseOmdbRatings } from './client';

const full = {
  Title: 'The Projectionist Night',
  imdbRating: '7.4',
  Metascore: '72',
  Ratings: [
    { Source: 'Internet Movie Database', Value: '7.4/10' },
    { Source: 'Rotten Tomatoes', Value: '85%' },
    { Source: 'Metacritic', Value: '72/100' },
  ],
  Response: 'True',
};

function fakeFetch(status: number, body: unknown = {}) {
  return vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
}

describe('lecture des notes OMDb', () => {
  it('lit les trois notes', () => {
    expect(parseOmdbRatings(full)).toEqual({ imdb: 7.4, rottenTomatoes: 85, metacritic: 72 });
  });

  it('traite N/A et les notes absentes comme null', () => {
    expect(
      parseOmdbRatings({ imdbRating: '6.1', Metascore: 'N/A', Ratings: [{ Source: 'Internet Movie Database', Value: '6.1/10' }], Response: 'True' }),
    ).toEqual({ imdb: 6.1, rottenTomatoes: null, metacritic: null });
    expect(parseOmdbRatings({ imdbRating: 'N/A', Metascore: '55', Response: 'True' })).toEqual({
      imdb: null,
      rottenTomatoes: null,
      metacritic: 55,
    });
  });

  it('se rabat sur l’entrée Metacritic de la liste quand Metascore manque', () => {
    expect(parseOmdbRatings({ imdbRating: 'N/A', Ratings: [{ Source: 'Metacritic', Value: '64/100' }], Response: 'True' })).toEqual({
      imdb: null,
      rottenTomatoes: null,
      metacritic: 64,
    });
  });

  it('rend null quand tout est N/A, quand la réponse est fausse ou illisible', () => {
    expect(parseOmdbRatings({ imdbRating: 'N/A', Metascore: 'N/A', Ratings: [], Response: 'True' })).toBeNull();
    expect(parseOmdbRatings({ Response: 'False', Error: 'Incorrect IMDb ID.' })).toBeNull();
    expect(parseOmdbRatings(null)).toBeNull();
    expect(parseOmdbRatings('texte')).toBeNull();
  });
});

describe('client OMDb', () => {
  const clientWith = (fetchFn: unknown, timeoutMs?: number) =>
    createOmdbClient({ apiKey: 'cle-secrete', fetchFn: fetchFn as typeof fetch, timeoutMs });

  it('interroge OMDb par identifiant IMDb', async () => {
    const fetchFn = fakeFetch(200, full);
    const r = await clientWith(fetchFn).ratings('tt1234567');
    expect(r).toEqual({ imdb: 7.4, rottenTomatoes: 85, metacritic: 72 });
    const url = fetchFn.mock.calls[0]![0] as URL;
    expect(url.origin + url.pathname).toBe('https://www.omdbapi.com/');
    expect(Object.fromEntries(url.searchParams)).toEqual({ i: 'tt1234567', apikey: 'cle-secrete' });
  });

  it('rend null quand OMDb ne connaît pas le film', async () => {
    const fetchFn = fakeFetch(200, { Response: 'False', Error: 'Incorrect IMDb ID.' });
    expect(await clientWith(fetchFn).ratings('tt0')).toBeNull();
  });

  it('lève une erreur typée sur une erreur HTTP, sans la clé dans le message', async () => {
    const err = await clientWith(fakeFetch(500)).ratings('tt1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OmdbError);
    expect((err as OmdbError).message).not.toContain('cle-secrete');
  });

  it('lève une erreur typée quand le réseau tombe ou que la réponse est illisible', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(clientWith(down).ratings('tt1')).rejects.toBeInstanceOf(OmdbError);
    const garbled = vi.fn(async () => new Response('<html>', { status: 200 }));
    await expect(clientWith(garbled).ratings('tt1')).rejects.toBeInstanceOf(OmdbError);
  });

  it('abandonne au bout du délai', async () => {
    const hang = vi.fn(
      (_url: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'TimeoutError')));
        }),
    );
    await expect(clientWith(hang, 20).ratings('tt1')).rejects.toBeInstanceOf(OmdbError);
  });
});
