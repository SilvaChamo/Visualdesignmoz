import { produtoPorSku } from '@/lib/catalogo-brindes';
import { cambioZarMzn } from '@/lib/cambio-brindes';
import { estimativaBrindes } from '@/lib/estimativa-brindes';
import { valorPorUnidadeMt, IVA_VENDA_PCT } from '@/lib/preco-brindes';

// o pedido de brindes escreve cada linha assim: «nome — ref. SKU (marca) — o que foi escolhido» (ver components/brindes/pedido.ts)
const REF_BRINDE = / — ref\. (\S+)(?: \([^)]*\))?(?: — (.*))?$/;

/** Valor por unidade, sem IVA, de um brinde do catálogo (o mesmo cálculo da calculadora e do site), ou null se não houver preço. SÓ PARA O SERVIDOR. */
export async function valorBrindeSemIva(descricao: string): Promise<number | null> {
  const sku = REF_BRINDE.exec(descricao)?.[1];
  const produto = sku ? produtoPorSku(sku) : null;
  const taxa = produto ? await cambioZarMzn() : null;
  if (!produto || !taxa) return null;
  const comIva = valorPorUnidadeMt(produto.precoZar, taxa, await estimativaBrindes());
  return Number.isFinite(comIva) && comIva > 0 ? Math.round((comIva / (1 + IVA_VENDA_PCT / 100)) * 100) / 100 : null;
}
