import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Film } from '../../shared/types';
import { LiveHub } from '../live/hub';
import { makeApp } from '../test/helpers';
import { JPG, MP4, PNG } from '../test/mediaFixtures';

const FILM = 'tmdb:1001';
const url = (kind: 'poster' | 'trailer', id = FILM) => `/api/films/${encodeURIComponent(id)}/${kind}`;

async function withFilm() {
  const ctx = await makeApp();
  await ctx.app.inject({ method: 'POST', url: `/api/films/${encodeURIComponent(FILM)}/refresh` });
  const put = (kind: 'poster' | 'trailer', type: string, payload: Buffer, id = FILM) =>
    ctx.app.inject({ method: 'PUT', url: url(kind, id), headers: { 'content-type': type }, payload });
  return { ...ctx, put };
}

const fileOf = (dir: string, mediaUrl: string | null) => join(dir, mediaUrl!.slice('/media/'.length));

describe('API fichiers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('envoie une affiche, la sert et diffuse', async () => {
    const { app, put } = await withFilm();
    const spy = vi.spyOn(LiveHub.prototype, 'broadcast');
    const res = await put('poster', 'image/png', PNG);
    expect(res.statusCode).toBe(200);
    const film = res.json() as Film;
    expect(film.customPosterUrl).toMatch(/^\/media\/[0-9a-f-]{36}\.png$/);
    expect(spy).toHaveBeenCalledTimes(1);
    const served = await app.inject(film.customPosterUrl!);
    expect(served.statusCode).toBe(200);
    expect(served.rawPayload.equals(PNG)).toBe(true);
  });

  it('remplace l’affiche et supprime l’ancien fichier', async () => {
    const { put, mediaDir } = await withFilm();
    const first = (await put('poster', 'image/png', PNG)).json() as Film;
    const second = (await put('poster', 'image/jpeg', JPG)).json() as Film;
    expect(existsSync(fileOf(mediaDir, first.customPosterUrl))).toBe(false);
    expect(existsSync(fileOf(mediaDir, second.customPosterUrl))).toBe(true);
  });

  it('garde l’affiche choisie quand TMDB actualise la fiche', async () => {
    const { app, put } = await withFilm();
    const { customPosterUrl } = (await put('poster', 'image/png', PNG)).json() as Film;
    const refreshed = await app.inject({ method: 'POST', url: `/api/films/${encodeURIComponent(FILM)}/refresh` });
    expect((refreshed.json() as Film).customPosterUrl).toBe(customPosterUrl);
  });

  it('envoie puis retire une vidéo', async () => {
    const { app, put, mediaDir } = await withFilm();
    const { localTrailerUrl } = (await put('trailer', 'video/mp4', MP4)).json() as Film;
    expect(localTrailerUrl).toMatch(/\.mp4$/);
    const res = await app.inject({ method: 'DELETE', url: url('trailer') });
    expect((res.json() as Film).localTrailerUrl).toBeNull();
    expect(existsSync(fileOf(mediaDir, localTrailerUrl))).toBe(false);
  });

  it('refuse un type inconnu, un fichier vide ou un contenu trompeur', async () => {
    const { app, put } = await withFilm();
    const text = await put('poster', 'text/plain', Buffer.from('bonjour'));
    expect(text.statusCode).toBe(415);
    expect(text.json()).toEqual({ error: 'invalid_type', message: 'Ce fichier n’est pas une image jpg, png ou webp.' });
    expect((await put('poster', 'application/octet-stream', PNG)).statusCode).toBe(415);
    expect((await put('poster', 'image/png', JPG)).statusCode).toBe(415);
    expect((await put('poster', 'image/png', Buffer.alloc(0))).statusCode).toBe(415);
    expect((await app.inject({ method: 'PUT', url: url('poster') })).statusCode).toBe(415);
  });

  it('répond 404 pour un film inconnu', async () => {
    const { app, put } = await withFilm();
    expect((await put('poster', 'image/png', PNG, 'tmdb:404')).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: url('poster', 'tmdb:404') })).statusCode).toBe(404);
  });

  it('retire une affiche dont le fichier a déjà disparu', async () => {
    const { app, put, mediaDir } = await withFilm();
    const { customPosterUrl } = (await put('poster', 'image/png', PNG)).json() as Film;
    rmSync(fileOf(mediaDir, customPosterUrl));
    const res = await app.inject({ method: 'DELETE', url: url('poster') });
    expect(res.statusCode).toBe(200);
    expect((res.json() as Film).customPosterUrl).toBeNull();
  });

  it('ne sert que les fichiers envoyés', async () => {
    const { app, mediaDir } = await withFilm();
    writeFileSync(join(mediaDir, 'secret.txt'), 'non');
    expect((await app.inject('/media/secret.txt')).statusCode).not.toBe(200);
  });
});
