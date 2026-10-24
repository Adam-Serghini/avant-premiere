import { exec } from 'node:child_process';
import { resolve } from 'node:path';
import { buildApp } from './app';
import { openDb } from './db';
import { createOmdbClient } from './omdb/client';
import { createRepo } from './repo';
import { createTmdbClient } from './tmdb/client';

try {
  process.loadEnvFile('.env');
} catch {
  // Pas de fichier .env : on continue avec les variables d'environnement existantes.
}

const port = Number(process.env.PORT ?? 4321);
const apiKey = process.env.TMDB_API_KEY?.trim() ?? '';
const tmdb = apiKey ? createTmdbClient({ apiKey }) : null;
const omdbKey = process.env.OMDB_API_KEY?.trim() ?? '';
const omdb = omdbKey ? createOmdbClient({ apiKey: omdbKey }) : null;
const repo = createRepo(openDb(resolve('data/cine-mardi.db')));
const app = await buildApp({ repo, tmdb, omdb, staticDir: resolve('dist/web'), mediaDir: resolve('data/media') });

try {
  await app.listen({ port, host: 'localhost' });
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
    console.error(
      `\n  Le port ${port} est déjà utilisé.\n` +
        `  Avant-Première tourne peut-être déjà dans une autre fenêtre : ouvre http://localhost:${port}\n` +
        '  Sinon, ferme le programme qui utilise ce port ou change PORT dans le fichier .env.\n',
    );
    process.exit(1);
  }
  throw err;
}

const url = `http://localhost:${port}`;
console.log(`\n  Avant-Première est prêt : ${url}\n  Régie : ${url}/regie\n  Source OBS : ${url}/overlay\n`);

if (!tmdb) {
  console.warn('  ⚠ Aucune clé TMDB : ajoute TMDB_API_KEY dans le fichier .env puis relance Avant-Première.\n');
} else {
  void tmdb.checkKey().then((status) => {
    if (status === 'invalid') console.warn('  ⚠ La clé TMDB est refusée : vérifie TMDB_API_KEY dans le fichier .env.\n');
    if (status === 'unavailable') console.warn('  ⚠ TMDB ne répond pas pour le moment.\n');
  });
}

if (process.argv.includes('--open')) {
  const command =
    process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(command);
}
