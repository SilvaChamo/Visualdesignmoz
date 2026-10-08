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
