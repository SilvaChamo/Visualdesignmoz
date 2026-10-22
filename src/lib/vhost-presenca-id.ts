const CHAVE_DISPOSITIVO = 'vh-presenca-dispositivo';
let idTemporario: string | null = null;
let avisouFalhaArmazenamento = false;

/** Identifica este navegador sem guardar dados pessoais, para distinguir os aparelhos ligados. */
export function idDispositivoPresenca(): string {
  if (typeof window === 'undefined') return '';
  let guardado: string | null = null;
  try {
    guardado = window.localStorage.getItem(CHAVE_DISPOSITIVO);
  } catch (erro) {
    if (!avisouFalhaArmazenamento) {
      console.warn('[VisualHost] não foi possível ler a identidade guardada deste aparelho', erro);
      avisouFalhaArmazenamento = true;
    }
  }
  if (guardado && /^[\da-f-]{36}$/i.test(guardado)) return guardado;
  const novo = idTemporario || window.crypto.randomUUID();
  idTemporario = novo;
  try {
    window.localStorage.setItem(CHAVE_DISPOSITIVO, novo);
  } catch (erro) {
    if (!avisouFalhaArmazenamento) {
      console.warn('[VisualHost] não foi possível guardar a identidade deste aparelho', erro);
      avisouFalhaArmazenamento = true;
    }
  }
  return novo;
}
