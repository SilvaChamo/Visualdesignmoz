import { NextResponse } from 'next/server'
import { requireAdminOrReseller } from '@/lib/panel-api-auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { UUID_LOTE } from '@/lib/cotacao-acesso'
import { encomendaPaymentSplit } from '@/lib/encomenda-checkout'
import { notifyQuoteClientQuotationReady } from '@/lib/notify-quote-client'

// «Autorizar e enviar ao cliente» (calculadora): até aqui os brindes de uma encomenda do site estão «sob consulta» e o cliente não vê valor nenhum. Esta rota grava o
// valor de cada linha personalizada (preço sem IVA × a quantidade que o CLIENTE definiu: a do servidor, nunca a da calculadora) e, quando já não resta nenhuma linha
// por consulta, avisa o cliente por e-mail, uma só vez. Autorizar de novo (corrigir valores) grava e não volta a enviar e-mail. Só administradores.
const round2 = (n: number) => Math.round(n * 100) / 100

export async function POST(req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const auth = await requireAdminOrReseller()
  if ('error' in auth) return auth.error
  if (auth.user.role !== 'admin') return NextResponse.json({ success: false, error: 'Acção restrita a administradores.' }, { status: 403 })
  const { batchId } = await params
  if (!UUID_LOTE.test(batchId)) return NextResponse.json({ success: false, error: 'Encomenda inválida.' }, { status: 400 })
  const corpo = (await req.json().catch(() => null)) as { precos?: { id?: unknown; precoUnitarioMt?: unknown }[] } | null
  const precos = Array.isArray(corpo?.precos) ? corpo.precos : []
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 503 })

  const { data: linhas, error } = await supabase.from('quotation_requests').select('id, quantidade, sob_consulta, sob_consulta_original, total_mt, email, empresa, responsavel, user_id').eq('batch_id', batchId)
  if (error || !linhas?.length) return NextResponse.json({ success: false, error: 'Encomenda não encontrada.' }, { status: 404 })

  // todas as linhas que nasceram por consulta têm de vir com valor: não se autoriza a meio
  const porConsulta = linhas.filter((l) => l.sob_consulta_original)
  const valores = new Map<string, number>()
  for (const p of precos) {
    const v = Number(p.precoUnitarioMt)
    if (typeof p.id !== 'string' || !porConsulta.some((l) => l.id === p.id) || !Number.isFinite(v) || round2(v) <= 0) return NextResponse.json({ success: false, error: 'Valor inválido.' }, { status: 400 })
    valores.set(p.id, round2(v))
  }
  if (porConsulta.some((l) => !valores.has(l.id))) return NextResponse.json({ success: false, error: 'Falta o valor de um ou mais produtos desta encomenda.' }, { status: 400 })

  const eraPorResponder = linhas.some((l) => l.sob_consulta)
  const agora = new Date().toISOString()
  for (const l of porConsulta) {
    const unitario = valores.get(l.id)!
    const { error: erroLinha } = await supabase
      .from('quotation_requests')
      .update({ preco_unitario_mt: unitario, total_mt: round2(unitario * Number(l.quantidade)), sob_consulta: false, updated_at: agora })
      .eq('id', l.id)
    if (erroLinha) return NextResponse.json({ success: false, error: `Não foi possível guardar: ${erroLinha.message}` }, { status: 500 })
  }

  // o total que o cliente paga: a soma sem IVA das linhas com valor, a mesma que a factura e o cartão usam
  const semIva = linhas.reduce((t, l) => t + (valores.has(l.id) ? round2(valores.get(l.id)! * Number(l.quantidade)) : l.sob_consulta ? 0 : Number(l.total_mt) || 0), 0)
  const totalComIvaMt = encomendaPaymentSplit(round2(semIva)).totalComIvaMt
  const restamPorConsulta = linhas.some((l) => l.sob_consulta && !valores.has(l.id))
  const enviado = eraPorResponder && !restamPorConsulta
  if (enviado) {
    const p = linhas[0]
    await notifyQuoteClientQuotationReady({ to: p.email, clientName: p.responsavel || p.empresa, totalComIvaMt, userId: p.user_id })
  }
  return NextResponse.json({ success: true, enviado, totalComIvaMt })
}
