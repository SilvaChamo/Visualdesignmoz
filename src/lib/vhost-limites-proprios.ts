/**
 * Limites próprios de uma conta (Personalizar): o servidor só conhece limites por pacote, por isso a conta passa a ter um pacote só
 * dela, «<conta>__<pacote de origem>» (ex.: joao__VHost-Basico). O nome guarda o pacote de origem, que continua a decidir as páginas
 * do plano. Nada é enviado ao dono da conta: não há e-mail nem aviso (Silva, 18/11/2026).
 */
export const nomeProprio = (u: string, base: string) => u + '__' + base;

/** O pacote de origem, se `pacote` for o pacote só desta conta; senão null */
export const baseDoProprio = (u: string, pacote: string): string | null => (u && pacote.startsWith(u + '__') ? pacote.slice(u.length + 2) : null);

/** Nome de um pacote só de uma conta (não é um pacote que se escolha nos selectores) */
export const ePacoteProprio = (nome: string): boolean => nome.includes('__');
