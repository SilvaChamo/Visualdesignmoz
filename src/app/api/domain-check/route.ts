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

    // Formata o domínio e o TLD correctamente
    let fullDomain = domain.toLowerCase().trim();
    
    // Se o user enviar apenas o nome sem TLD e um TLD no campo tld
    if (!fullDomain.includes('.') && tld) {
      const cleanTld = tld.startsWith('.') ? tld.substring(1) : tld;
      fullDomain = `${fullDomain}.${cleanTld}`;
    }

    const supabase = getSupabaseAdmin();
    
    // 1. Iniciar chamadas à base de dados (Rate Limit) e API do registador em paralelo
    const threshold = new Date(Date.now() - 300 * 1000).toISOString();
    const dbPromise = supabase
      ? supabase
          .from('domain_check_logs')
          .select('*', { count: 'exact', head: true })
          .eq('domain', fullDomain)
          .gte('created_at', threshold)
      : Promise.resolve(null);

    const apiPromise = checkAvailability(fullDomain);

    // Aguarda ambas as promessas em paralelo (reduz de 3 roundtrips para 1)
    const [dbResult, result] = await Promise.all([dbPromise, apiPromise]);

    // 2. Verificar o resultado do Rate Limit da BD
    if (dbResult && 'count' in dbResult) {
      const { count, error: countError } = dbResult;
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

      // 3. Registar o log de pesquisa de forma assíncrona (não-bloqueante/fire-and-forget)
      supabase!
        .from('domain_check_logs')
        .insert({ domain: fullDomain })
        .then(({ error }) => {
          if (error) console.error('[API] Erro ao registar log de pesquisa:', error);
        });
    }

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
