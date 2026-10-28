#!/usr/bin/env node
/**
 * Generates poster images and short hover previews for the /demos gallery.
 *
 * Sources are the full demo clips already living in static/img. For each entry
 * in src/data/demos.json it writes:
 *
 *   static/img/demos/<id>.webp  - poster frame taken at `posterAt` (or `at`)
 *   static/img/demos/<id>.mp4   - muted 6s preview played on card hover
 *
 * Existing files are kept unless --force is passed. Use --only=id1,id2 to
 * regenerate a subset (e.g. after changing `at` for one demo).
 *
 *   node scripts/gen-demo-media.mjs [--force] [--only=cursors,drones]
 *
 * Requires ffmpeg in PATH.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'static/img/demos');

const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length).split(',') : null;

const PREVIEW_SECONDS = 6;
const PREVIEW_WIDTH = 640;
const POSTER_WIDTH = 720;

const { demos } = JSON.parse(readFileSync(join(root, 'src/data/demos.json'), 'utf8'));

mkdirSync(outDir, { recursive: true });

const ffmpeg = (params) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...params], { stdio: 'inherit' });
const kb = (file) => `${Math.round(statSync(file).size / 1024)}KB`;

let generated = 0;
for (const demo of demos) {
  if (only && !only.includes(demo.id)) continue;

  const source = join(root, 'static', demo.video);
  if (!existsSync(source)) {
    console.error(`✗ ${demo.id}: source not found - ${demo.video}`);
    process.exitCode = 1;
    continue;
  }

  const at = String(demo.at ?? 0);
  const posterAt = String(demo.posterAt ?? demo.at ?? 0);
  const poster = join(outDir, `${demo.id}.webp`);
  const preview = join(outDir, `${demo.id}.mp4`);

  if (force || !existsSync(poster)) {
    ffmpeg(['-ss', posterAt, '-i', source, '-frames:v', '1',
      '-vf', `scale=${POSTER_WIDTH}:-2:flags=lanczos`,
      '-c:v', 'libwebp', '-quality', '76', poster]);
    generated++;
  }

  if (force || !existsSync(preview)) {
    ffmpeg(['-ss', at, '-t', String(PREVIEW_SECONDS), '-i', source, '-an',
      '-vf', `fps=20,scale=${PREVIEW_WIDTH}:-2:flags=lanczos`,
      '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '32',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', preview]);
    generated++;
  }

  console.log(`✓ ${demo.id.padEnd(20)} poster ${kb(poster).padStart(6)}   preview ${kb(preview).padStart(6)}`);
}

console.log(generated ? `\nWrote ${generated} file(s) to static/img/demos` : '\nNothing to do (pass --force to regenerate).');
