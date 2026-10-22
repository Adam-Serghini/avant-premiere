import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { createMediaStore, sniff } from './media';
import { JPG, MP4, PNG } from './test/mediaFixtures';

let dir = '';
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const store = () => {
  dir = mkdtempSync(join(tmpdir(), 'avant-premiere-media-'));
  return createMediaStore(dir);
};

describe('stockage des fichiers', () => {
  it('reconnaît les signatures', () => {
    expect(sniff(PNG)).toBe('png');
    expect(sniff(JPG)).toBe('jpg');
    expect(sniff(MP4)).toBe('mp4');
    expect(sniff(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]))).toBe('webp');
    expect(sniff(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))).toBe('webm');
    expect(sniff(Buffer.from('bonjour'))).toBeNull();
  });

  it('écrit le fichier et renvoie son adresse', async () => {
    const media = store();
    const url = await media.save('poster', 'image/png', Readable.from([PNG]));
    expect(url).toMatch(/^\/media\/[0-9a-f-]{36}\.png$/);
    expect(readdirSync(dir)).toEqual([url.slice('/media/'.length)]);
  });

  it('refuse un contenu qui ne correspond pas au type annoncé, sans rien laisser', async () => {
    const media = store();
    await expect(media.save('poster', 'image/png', Readable.from([JPG]))).rejects.toMatchObject({ status: 415 });
    await expect(media.save('trailer', 'image/png', Readable.from([PNG]))).rejects.toMatchObject({
      status: 415,
      message: 'Ce fichier n’est pas une vidéo mp4 ou webm.',
    });
    await expect(media.save('poster', 'image/png', Readable.from([Buffer.alloc(0)]))).rejects.toMatchObject({ status: 415 });
    expect(readdirSync(dir)).toEqual([]);
  });

  it('refuse un fichier trop lourd, annoncé ou reçu', async () => {
    const media = store();
    await expect(media.save('poster', 'image/png', Readable.from([PNG]), 21 * 1024 * 1024)).rejects.toMatchObject({
      status: 413,
      message: 'Fichier trop lourd (20 Mo maximum).',
    });
    const big = Buffer.concat([PNG, Buffer.alloc(20 * 1024 * 1024)]);
    await expect(media.save('poster', 'image/png', Readable.from([big]))).rejects.toMatchObject({ status: 413 });
    expect(readdirSync(dir)).toEqual([]);
  });

  it('échoue proprement si le fichier ne peut pas être écrit (petit envoi)', async () => {
    const media = store();
    rmSync(dir, { recursive: true, force: true });
    await expect(media.save('poster', 'image/png', Readable.from([PNG]))).rejects.toMatchObject({ status: 500 });
  });

  it('échoue proprement si le fichier ne peut pas être écrit (gros envoi)', async () => {
    const media = store();
    rmSync(dir, { recursive: true, force: true });
    const chunks = [PNG, ...Array.from({ length: 8 }, () => Buffer.alloc(64 * 1024))];
    await expect(media.save('poster', 'image/png', Readable.from(chunks))).rejects.toMatchObject({ status: 500 });
  });

  it('supprime un fichier, même déjà absent, et ignore les adresses étrangères', async () => {
    const media = store();
    const url = await media.save('poster', 'image/png', Readable.from([PNG]));
    media.remove(url);
    media.remove(url);
    media.remove('https://image.tmdb.org/t/p/w780/a.jpg');
    media.remove('/media/../db.sqlite');
    media.remove(null);
    expect(readdirSync(dir)).toEqual([]);
  });
});
