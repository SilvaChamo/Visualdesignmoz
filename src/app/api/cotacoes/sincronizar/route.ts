import { NextResponse } from 'next/server'
import { podeEditarCotacao, UUID_LOTE } from '@/lib/cotacao-acesso'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { produtoPorSku } from '@/lib/catalogo-brindes'

// A quantidade (e o produto) que se edita na cotação passam às linhas da encomenda, para o painel do administrador, o do cliente, o cartão e os pagamentos mostrarem o mesmo.
// O valor por unidade nunca vem do navegador. Uma linha cujo valor vem da calculadora (nasceu «sob consulta») volta a ficar por consulta quando muda a quantidade ou o produto: os custos da
// remessa repartem-se de outra forma e só a equipa autoriza o valor novo (o cliente é avisado de novo). As outras linhas mantêm o valor que a equipa definiu.
const REF = / — ref\. (\S+)(?: \([^)]*\))?(?: — (.*))?$/
const EDITAVEIS = ['pending', 'payment_selected', 'rejected']

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => null)) as { batchId?: string; linhas?: { id?: string; quantidade?: number; sku?: string }[] } | null
  const batchId = corpo?.batchId ?? ''
  if (!UUID_LOTE.test(batchId) || !Array.isArray(corpo?.linhas) || corpo.linhas.length > 60) return NextResponse.json({ success: false, error: 'Pedido inválido.' }, { status: 400 })
  const a = await podeEditarCotacao(batchId)
  if ('erro' in a) return a.erro
  const supabase = getSupabaseAdmin()
  if (!supabase) return NextResponse.json({ success: false, error: 'Serviço indisponível.' }, { status: 503 })
  const { data: linhas, error } = await supabase.from('quotation_requests').select('id, produto, quantidade, preco_unitario_mt, sob_consulta_original, status').eq('batch_id', batchId)
  if (error || !linhas?.length) return NextResponse.json({ success: false, error: 'Encomenda não encontrada.' }, { status: 404 })
  // o dono só altera enquanto a equipa ainda não aprovou; depois só o administrador
  if (!a.admin && linhas.some((l) => !EDITAVEIS.includes(l.status))) return NextResponse.json({ success: false, error: 'Esta encomenda já foi aprovada: peça a alteração à equipa.' }, { status: 409 })
  const resultado: { id: string; quantidade: number; preco: number; produto: string }[] = []
  for (const pedido of corpo.linhas) {
    const atual = linhas.find((l) => l.id === pedido.id)
    const quantidade = Math.round(Number(pedido.quantidade))
    if (!atual || !Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 99999) continue
    let produto: string = atual.produto
    const sku = REF.exec(atual.produto)?.[1]
    if (pedido.sku && pedido.sku !== sku) {
      // só se troca o produto das linhas cujo valor vem da calculadora; as outras têm o valor do produto que lá está
      if (!atual.sob_consulta_original) continue
      const novo = produtoPorSku(pedido.sku.slice(0, 80))
      if (novo) produto = `${novo.nome} — ref. ${pedido.sku}${REF.exec(atual.produto)?.[2] ? ` — ${REF.exec(atual.produto)![2]}` : ''}`.slice(0, 255)
    }
    // a mesma quantidade e o mesmo produto (ao gravar a folha sem mexer nas linhas): não há nada a actualizar
    if (quantidade === Number(atual.quantidade) && produto === atual.produto) continue
    const porConsulta = Boolean(atual.sob_consulta_original)
    const preco = porConsulta ? 0 : Number(atual.preco_unitario_mt)
    if (!porConsulta && !(preco > 0)) continue
    const { error: e } = await supabase.from('quotation_requests').update({ produto, quantidade, preco_unitario_mt: preco, total_mt: Math.round(preco * quantidade * 100) / 100, sob_consulta: porConsulta, updated_at: new Date().toISOString() }).eq('id', atual.id)
    if (!e) resultado.push({ id: atual.id, quantidade, preco, produto })
  }
  return NextResponse.json({ success: true, linhas: resultado })
}
