/**
 * Comprovativos de pagamento de uma encomenda (adiantamento 70% /
 * remanescente 30%). Vivem em quotation_attachments como qualquer anexo, mas
 * a fase fica marcada no próprio caminho do ficheiro no bucket — sem coluna
 * nova na tabela (a base de dados é partilhada com produção) — para a
 * Contabilidade › Encomendas e a página de pagamento saberem qual é qual.
 * Um comprovativo rejeitado pela equipa não é apagado (fica como registo):
 * o nome do ficheiro ganha o prefixo COMPROVATIVO_REJEITADO_PREFIX.
 */
export type ComprovativoFase = 'adiantamento' | 'remanescente';

export const COMPROVATIVO_FASES: ComprovativoFase[] = ['adiantamento', 'remanescente'];

export const COMPROVATIVO_REJEITADO_PREFIX = '[Rejeitado] ';

const MARKER = '/comprovativo-';

export function isComprovativoFase(value: unknown): value is ComprovativoFase {
  return COMPROVATIVO_FASES.includes(value as ComprovativoFase);
}

/** Caminho no bucket de um comprovativo novo — `<quotationId>/comprovativo-<fase>-<timestamp>-<nome>.<ext>`. */
export function comprovativoStoragePath(quotationId: string, fase: ComprovativoFase, safeName: string, ext: string): string {
  return `${quotationId}${MARKER}${fase}-${Date.now()}-${safeName}.${ext}`;
}

/** Fase a partir do caminho guardado (não do URL assinado); null para anexos sem marca (antigos ou outros ficheiros). */
export function comprovativoFaseFromPath(path: string | null | undefined): ComprovativoFase | null {
  if (!path) return null;
  return COMPROVATIVO_FASES.find((fase) => path.includes(`${MARKER}${fase}-`)) ?? null;
}

export function isComprovativoRejeitado(fileName: string | null | undefined): boolean {
  return Boolean(fileName?.startsWith(COMPROVATIVO_REJEITADO_PREFIX));
}

/**
 * Comprovativo em vigor de uma fase, entre os anexos do cliente de uma
 * encomenda (ordenados do mais antigo para o mais recente), ignorando os já
 * rejeitados: o último marcado com essa fase; para encomendas anteriores à
 * marca, o primeiro anexo sem marca conta como adiantamento e o último como
 * remanescente — só se houver mais do que um, senão seria o do adiantamento.
 */
export function pickComprovativo<T extends { file_url: string; file_name: string }>(
  anexos: T[],
  fase: ComprovativoFase,
): T | null {
  const validos = anexos.filter((a) => !isComprovativoRejeitado(a.file_name));
  const marcados = validos.filter((a) => comprovativoFaseFromPath(a.file_url) === fase);
  if (marcados.length > 0) return marcados[marcados.length - 1];
  const semMarca = validos.filter((a) => !a.file_url.includes(MARKER));
  if (semMarca.length === 0) return null;
  if (fase === 'adiantamento') return semMarca[0];
  return semMarca.length > 1 ? semMarca[semMarca.length - 1] : null;
}
