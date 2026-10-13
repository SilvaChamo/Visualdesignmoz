/** Cookie de sessão do Supabase (o nome leva o projeto; partido em pedaços .0, .1, … quando é grande) */
export const COOKIE_SESSAO = /^sb-.+-auth-token(\.\d+)?$/;

/** Cabeçalho que o proxy junta ao pedido de uma página do painel: '1' sessão confirmada, '0' sem sessão */
export const SESSAO_PAINEL = 'x-vh-sessao';
