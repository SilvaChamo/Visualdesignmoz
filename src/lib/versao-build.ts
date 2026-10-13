import fs from 'fs';
import path from 'path';

// Versão do site que este servidor está a servir: o BUILD_ID do Next (muda a cada publicação). Lida uma vez por
// processo — cada processo serve sempre o mesmo build. Sem build (desenvolvimento) fica "dev".
let versao: string | null = null;

export function versaoBuild(): string {
  if (versao) return versao;
  try {
    versao = fs.readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim() || 'dev';
  } catch {
    versao = 'dev';
  }
  return versao;
}

/** Quando foi feita a versão que está a ser servida (hora do BUILD_ID), ou null em desenvolvimento */
export function quandoBuild(): Date | null {
  try {
    return fs.statSync(path.join(process.cwd(), '.next', 'BUILD_ID')).mtime;
  } catch {
    return null;
  }
}
