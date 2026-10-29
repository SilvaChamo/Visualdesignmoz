/**
 * Diz o que está mal num e-mail (ou null se está bem), em português claro, para o formulário poder ser específico em vez de
 * dizer só «não foi possível» (Silva, 29/10/2026: um acento grave no e-mail passava e o pedido falhava sem explicação).
 */
export function problemaDoEmail(email: string): string | null {
  const v = String(email || '').trim();
  if (!v) return 'está vazio';
  if (v.length > 160) return 'é demasiado comprido';
  if (/\s/.test(v)) return 'tem espaços';
  const arrobas = (v.match(/@/g) || []).length;
  if (arrobas === 0) return 'falta o @';
  if (arrobas > 1) return 'tem mais de um @';
  const [nome, dominio] = v.split('@');
  if (!nome) return 'falta o nome antes do @';
  if (!dominio) return 'falta o domínio depois do @ (ex.: nome@dominio.com)';
  const simbolos = [...new Set([...(nome.match(/[^a-z0-9._%+-]/gi) || []), ...(dominio.match(/[^a-z0-9.-]/gi) || [])])];
  if (simbolos.length) return `tem ${simbolos.length > 1 ? 'os símbolos' : 'o símbolo'} ${simbolos.map((c) => `«${c}»`).join(' ')}, que não se usa em e-mails`;
  if (!/\.[a-z]{2,}$/i.test(dominio) || dominio.startsWith('.') || dominio.includes('..')) return 'o domínio está incompleto (ex.: nome@dominio.com)';
  return null;
}

/** «O e-mail X não é válido: …» ou null */
export function mensagemEmailInvalido(email: string, quem = 'O e-mail'): string | null {
  const problema = problemaDoEmail(email);
  return problema ? `${quem} «${String(email).trim()}» não é válido: ${problema}.` : null;
}
