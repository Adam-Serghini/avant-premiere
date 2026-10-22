import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { HttpError } from './http';

export type MediaKind = 'poster' | 'trailer';
type Ext = 'jpg' | 'png' | 'webp' | 'mp4' | 'webm';

export const MEDIA_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm)$/;

const MB = 1024 * 1024;

const KINDS: Record<MediaKind, { maxBytes: number; types: Record<string, Ext>; tooBig: string; badType: string }> = {
  poster: {
    maxBytes: 20 * MB,
    types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
    tooBig: 'Fichier trop lourd (20 Mo maximum).',
    badType: 'Ce fichier n’est pas une image jpg, png ou webp.',
  },
  trailer: {
    maxBytes: 1024 * MB,
    types: { 'video/mp4': 'mp4', 'video/webm': 'webm' },
    tooBig: 'Fichier trop lourd (1 Go maximum).',
    badType: 'Ce fichier n’est pas une vidéo mp4 ou webm.',
  },
};

export function invalidType(kind: MediaKind): HttpError {
  return new HttpError(415, 'invalid_type', KINDS[kind].badType);
}

/** Identifie le format d'après les premiers octets, sans se fier au nom ni au type annoncé. */
export function sniff(head: Buffer): Ext | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg';
  if (head.length >= 4 && head.readUInt32BE(0) === 0x89504e47) return 'png';
  if (head.length >= 12 && head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (head.length >= 8 && head.toString('latin1', 4, 8) === 'ftyp') return 'mp4';
  if (head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3) return 'webm';
  return null;
}

export interface MediaStore {
  save(kind: MediaKind, contentType: string | undefined, body: Readable, declaredLength?: number): Promise<string>;
  remove(url: string | null): void;
}

export function createMediaStore(dir: string): MediaStore {
  mkdirSync(dir, { recursive: true });

  return {
    async save(kind, contentType, body, declaredLength) {
      const spec = KINDS[kind];
      const ext = spec.types[(contentType ?? '').split(';')[0]!.trim().toLowerCase()];
      if (!ext) {
        body.resume();
        throw invalidType(kind);
      }
      if (declaredLength !== undefined && declaredLength > spec.maxBytes) {
        body.resume();
        throw new HttpError(413, 'too_large', spec.tooBig);
      }

      const name = `${randomUUID()}.${ext}`;
      const file = join(dir, name);
      const out = createWriteStream(file);
      // Une erreur d'écriture (dossier supprimé, disque plein, antivirus) ne doit ni tuer le serveur ni bloquer la requête.
      const failed = new Promise<never>((_, reject) => out.once('error', reject));
      failed.catch(() => {});
      let size = 0;
      let head = Buffer.alloc(0);
      let checked = false;
      const check = () => {
        if (sniff(head) !== ext) throw invalidType(kind);
        checked = true;
      };

      try {
        for await (const chunk of body as AsyncIterable<Buffer>) {
          size += chunk.length;
          if (size > spec.maxBytes) throw new HttpError(413, 'too_large', spec.tooBig);
          if (!checked) {
            head = Buffer.concat([head, chunk]);
            if (head.length >= 12) check();
          }
          if (!out.write(chunk)) await Promise.race([once(out, 'drain'), failed]);
        }
        if (!checked) check();
        await Promise.race([new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve()))), failed]);
      } catch (err) {
        // On attend la fermeture du fichier avant de le supprimer (Windows refuse sinon).
        if (!out.closed) {
          await new Promise<void>((resolve) => {
            out.once('close', () => resolve());
            out.destroy();
          });
        }
        rmSync(file, { force: true });
        if (err instanceof HttpError) throw err;
        throw new HttpError(500, 'write_failed', 'Impossible d’enregistrer le fichier sur le disque.');
      }
      return `/media/${name}`;
    },

    remove(url) {
      const name = url?.startsWith('/media/') ? url.slice('/media/'.length) : null;
      if (name && MEDIA_NAME.test(name)) rmSync(join(dir, name), { force: true });
    },
  };
}
