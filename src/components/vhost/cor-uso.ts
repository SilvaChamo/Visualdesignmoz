// Cor de uma medição que enche (espaço em disco, caixa de e-mail, CPU, memória, quotas…): verde enquanto há folga, âmbar a partir de 65 %
// e vermelho a partir de 85 % — a mesma escala do cartão do CPU (Silva, 22/10/2026: "cards com cores correspondentes à situação").
export const corUso = (p: number): string => (p >= 85 ? 'var(--red)' : p >= 65 ? '#f59e0b' : '#10b981');
