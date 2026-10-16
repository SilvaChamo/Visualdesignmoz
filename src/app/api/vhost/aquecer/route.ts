import { NextResponse } from 'next/server';
import { lerServidor } from '@/lib/vhost-servidor';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vhost/aquecer — o login do site chama isto ao abrir, para a leitura do servidor (a que o login espera antes
 * de entrar no painel, /api/vhost/dados) começar enquanto se escrevem as credenciais, e não só depois de a sessão
 * abrir: com a memória fria (mais de 10 min sem ninguém no painel, ou depois de uma publicação) era essa leitura
 * inteira que se esperava com o botão em "A entrar…" (Silva, 16/10/2026: "leva um século para autorizar entrada").
 * Não devolve dados nenhuns. Não precisa de sessão: a leitura fica em memória 60 s e nunca há duas ao mesmo tempo
 * (lerServidor), por isso chamar isto muitas vezes não pesa mais no servidor.
 */
export async function POST() {
  lerServidor().catch(() => {});
  return new NextResponse(null, { status: 204 });
}
