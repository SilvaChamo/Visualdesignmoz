import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * API para resetar limites de email (limpar reputação)
 * GET /api/reset-email-limits - Lista todas as reputações
 * POST /api/reset-email-limits - Reseta contadores (opcional: ?domain=xxx)
 */

export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('domain_reputation')
      .select('*')
      .order('domain');
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      domains: data || [],
      count: data?.length || 0
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain');
    
    let result;
    
    if (domain) {
      // Resetar apenas um domínio específico
      const { data, error } = await supabaseAdmin
        .from('domain_reputation')
        .update({
          emails_sent_today: 0,
          last_send_date: new Date().toISOString(),
          bounce_rate: 0,
          complaint_rate: 0
        })
        .eq('domain', domain)
        .select();
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      result = { domain, updated: data };
    } else {
      // Resetar TODOS os domínios
      const { data, error } = await supabaseAdmin
        .from('domain_reputation')
        .update({
          emails_sent_today: 0,
          last_send_date: new Date().toISOString()
        })
        .gt('emails_sent_today', 0) // Só onde tem contador > 0
        .select();
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      result = { allDomains: true, updated: data, count: data?.length || 0 };
    }
    
    return NextResponse.json({ 
      success: true, 
      message: domain 
        ? `Domínio ${domain} resetado com sucesso`
        : `${result.count} domínio(s) resetado(s) com sucesso`,
      result
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
