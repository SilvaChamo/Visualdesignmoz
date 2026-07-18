import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id em falta' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('checkout_sessions')
    .select('id, status, items, total_mt')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
  }

  return NextResponse.json({ success: true, session: data });
}
