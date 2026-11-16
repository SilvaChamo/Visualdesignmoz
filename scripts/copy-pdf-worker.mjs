import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const workerSource = join(rootDir, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const workerTargetDir = join(rootDir, 'public', 'pdfjs');
const workerTarget = join(workerTargetDir, 'pdf.worker.min.mjs');

if (!existsSync(workerSource)) {
  console.error(`PDF.js worker not found at ${workerSource}`);
  process.exit(1);
}

mkdirSync(workerTargetDir, { recursive: true });
cpSync(workerSource, workerTarget);
console.log(`Copied PDF.js worker to ${workerTarget}`);

// a pré-visualização de PDF do VhostMail (anexos) desenha as páginas com o PDF.js: precisa também da biblioteca, não só do worker
const libSource = join(rootDir, 'node_modules', 'pdfjs-dist', 'build', 'pdf.min.mjs');
if (existsSync(libSource)) {
  cpSync(libSource, join(workerTargetDir, 'pdf.min.mjs'));
  console.log('Copied PDF.js library to ' + join(workerTargetDir, 'pdf.min.mjs'));
}
