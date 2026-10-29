/**
 * Que ficheiros se aceitam como comprovativo de pagamento: imagens e PDF. O navegador já limita (`accept`), mas o servidor
 * nunca confia nisso — um ficheiro de outro tipo (HTML, SVG, executável) ficaria guardado e seria aberto pela equipa.
 */
const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf']);
const EXTENSOES = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'pdf']);

export function comprovativoValido(file: { name: string; type?: string }): boolean {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!EXTENSOES.has(ext)) return false;
  // alguns telemóveis enviam o tipo vazio: nesse caso conta a extensão
  const tipo = (file.type || '').toLowerCase();
  return !tipo || TIPOS.has(tipo);
}

export const COMPROVATIVO_ERRO = 'Envie o comprovativo em imagem (JPG, PNG, WEBP, HEIC) ou PDF.';
