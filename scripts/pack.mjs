// Fabrique release/Avant-Premiere.zip : une version prête à l'emploi pour Windows, Node portable compris.
// Le Node embarqué est celui qui lance ce script, pour que le module SQLite compilé lui corresponde.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

if (process.platform !== 'win32') throw new Error('Le zip se fabrique sous Windows (module SQLite compilé pour Windows).');

const root = resolve(import.meta.dirname, '..');
const releaseDir = join(root, 'release');
const cacheDir = join(releaseDir, 'cache');
const stage = join(releaseDir, 'Avant-Premiere');
const zip = join(releaseDir, 'Avant-Premiere.zip');
const nodeName = `node-${process.version}-win-x64`;
const npm = (args, cwd) => execFileSync('npm', args, { cwd, stdio: 'inherit', shell: true });
const crlf = (text) => text.replace(/\r?\n/g, '\r\n');

rmSync(stage, { recursive: true, force: true });
rmSync(zip, { force: true });
mkdirSync(cacheDir, { recursive: true });

console.log('Interface…');
npm(['run', 'build'], root);
cpSync(join(root, 'dist/web'), join(stage, 'dist/web'), { recursive: true });

console.log('Serveur…');
await build({
  entryPoints: [join(root, 'server/main.ts')],
  outfile: join(stage, 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  logLevel: 'warning',
});

console.log('Dépendances…');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
delete pkg.scripts;
writeFileSync(join(stage, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
copyFileSync(join(root, 'package-lock.json'), join(stage, 'package-lock.json'));
npm(['ci', '--omit=dev', '--no-audit', '--no-fund'], stage);

console.log(`Node portable (${process.version})…`);
const archive = join(cacheDir, `${nodeName}.zip`);
if (!existsSync(archive)) {
  const base = `https://nodejs.org/dist/${process.version}`;
  const res = await fetch(`${base}/${nodeName}.zip`);
  if (!res.ok) throw new Error(`Téléchargement de Node impossible : ${res.status}`);
  const data = Buffer.from(await res.arrayBuffer());
  const sums = await (await fetch(`${base}/SHASUMS256.txt`)).text();
  const expected = sums.split('\n').find((l) => l.endsWith(`  ${nodeName}.zip`))?.split(' ')[0];
  const actual = createHash('sha256').update(data).digest('hex');
  if (!expected || expected !== actual) throw new Error('Empreinte de Node incorrecte : téléchargement refusé.');
  writeFileSync(archive, data);
}
// Le tar de Windows sait lire les zip, contrairement à celui de Git.
const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
execFileSync(tar, ['-x', '-f', archive, '-C', cacheDir, `${nodeName}/node.exe`, `${nodeName}/LICENSE`]);
mkdirSync(join(stage, 'node'));
copyFileSync(join(cacheDir, nodeName, 'node.exe'), join(stage, 'node/node.exe'));
copyFileSync(join(cacheDir, nodeName, 'LICENSE'), join(stage, 'node/LICENSE'));

console.log('Fichiers d’accompagnement…');
for (const name of ['Avant-Premiere.bat', 'LISEZMOI.txt']) {
  writeFileSync(join(stage, name), crlf(readFileSync(join(root, 'scripts/pack', name), 'utf8')));
}
copyFileSync(join(root, '.env.example'), join(stage, '.env.example'));
copyFileSync(join(root, 'README.md'), join(stage, 'README.md'));

console.log('Zip…');
// Pas le tar de Windows ici : il plante en écrivant un gros zip.
execFileSync('powershell', [
  '-NoProfile',
  '-Command',
  `Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('${stage}', '${zip}', 'Optimal', $true)`,
]);
console.log(`\nPrêt : ${zip}\n`);
