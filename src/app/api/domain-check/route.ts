import { NextResponse } from 'next/server';
import { checkAvailability } from '@/lib/spaceship-adapter';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { domain, tld } = await req.json();
    console.log(`[API] Verificando domínio: ${domain} com TLD: ${tld} (via Spaceship)`);
    
    if (!domain) {
      return NextResponse.json({ status: 'ERROR', message: 'Domínio não fornecido' }, { status: 400 });
    }

    // Formata o domínio e o TLD corretamente
    let fullDomain = domain.toLowerCase().trim();
    
    // Se o user enviar apenas o nome sem TLD e um TLD no campo tld
    if (!fullDomain.includes('.') && tld) {
      const cleanTld = tld.startsWith('.') ? tld.substring(1) : tld;
      fullDomain = `${fullDomain}.${cleanTld}`;
    }

    // 1. Verificar Rate Limit no Supabase (5 requisições por domínio a cada 300 segundos)
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const threshold = new Date(Date.now() - 300 * 1000).toISOString();
      const { count, error: countError } = await supabase
        .from('domain_check_logs')
        .select('*', { count: 'exact', head: true })
        .eq('domain', fullDomain)
        .gte('created_at', threshold);

      if (countError) {
        console.error('[API] Erro ao verificar rate limit no Supabase:', countError);
      } else if (count !== null && count >= 5) {
        console.log(`[API] Rate limit atingido para ${fullDomain} (${count} pedidos nos últimos 300s)`);
        return NextResponse.json(
          {
            available: false,
            error: 'Limite de pesquisas atingido para este domínio (5 pedidos a cada 300 segundos). Por favor, aguarde.'
          },
          { status: 429 }
        );
      }

      // Registar a tentativa de pesquisa
      const { error: insertError } = await supabase
        .from('domain_check_logs')
        .insert({ domain: fullDomain });
      
      if (insertError) {
        console.error('[API] Erro ao registar log de pesquisa no Supabase:', insertError);
      }
    } else {
      console.warn('[API] Cliente admin do Supabase não configurado. Rate limiting desativado.');
    }

    const result = await checkAvailability(fullDomain);
    console.log(`[API] Resultado do adaptador para ${fullDomain}:`, result);

    if ((result as any).error) {
      return NextResponse.json({ available: false, error: (result as any).error }, { status: 400 });
    }

    return NextResponse.json({
      available: result.available,
      domain: fullDomain,
      price: result.price,
      currency: result.currency || 'USD',
    });
  } catch (error) {
    console.error('API Domain Check Error:', error);
    return NextResponse.json({ available: false, error: 'Erro interno no servidor' }, { status: 500 });
  }
}
