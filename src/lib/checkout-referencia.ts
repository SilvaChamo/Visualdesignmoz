/**
 * Referência curta de um pedido do carrinho (checkout_sessions): os 8 primeiros caracteres do identificador, em maiúsculas
 * (a mesma regra das renovações). É o que o cliente escreve na transferência/M-Pesa e o que a equipa procura para casar o
 * pagamento com o pedido. Sem dependências de servidor: serve o checkout, o painel e os avisos.
 */
export function referenciaPedido(id: string): string {
  return String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Pedidos manuais sem comprovativo ficam abertos este tempo; passado, expiram (ver expirarPedidosManuais). */
export const PEDIDO_MANUAL_VALIDADE_DIAS = 30;
