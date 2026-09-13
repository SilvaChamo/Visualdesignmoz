// Sincroniza a tabela domain_tld_price_overrides com os preços reais da
// Dynadot. Chamado pela rota de cron /api/cron/sync-domain-prices — nunca
// corre no browser.
//
// #10 (2026-09-13, backport de visualdesign-teste): antes pedia um preço de
// cada vez (`getTldPrice(tld)`), que falhava sempre nas 44 extensões porque
// esse comando da API3 não aceita filtrar por `tld` — nunca escreveu uma
// linha sequer desde que foi criado (confirmado: `domain_tld_price_overrides`
// estava vazia apesar do robô "ter sucesso" todas as semanas). Agora pede a
// lista completa de uma vez (`getAllTldPrices`) e cruza com as extensões que
// vendemos.
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { dynadotAPI } from '@/lib/dynadot-adapter';
import { DOMAIN_TLD_PRICES } from '@/lib/domain-tld-prices';

export type DomainPriceSyncResult = {
  updated: string[];
  failed: { tld: string; error: string }[];
};

/**
 * Guarda contra uma leitura da API mal interpretada (ex.: preço de retalho
 * em vez de preço de revendedor) — nunca aplicar um valor absurdamente
 * diferente do que já temos sem alguém rever primeiro. Um aumento real de
 * registo (como o do .com, Nov/2026) fica bem dentro desta margem; só
 * bloqueia leituras claramente erradas.
 */
const MAX_PLAUSIBLE_CHANGE_RATIO = 0.5;

function isPlausible(oldUsd: number, newUsd: number): boolean {
  if (oldUsd <= 0) return true;
  const change = Math.abs(newUsd - oldUsd) / oldUsd;
  return change <= MAX_PLAUSIBLE_CHANGE_RATIO;
}

export async function syncAllTldPrices(): Promise<DomainPriceSyncResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const result: DomainPriceSyncResult = { updated: [], failed: [] };
  if (!supabaseUrl || !serviceKey) {
    result.failed.push({ tld: '*', error: 'Supabase Service Role não configurado.' });
    return result;
  }
  const admin = createAdminClient(supabaseUrl, serviceKey);

  const fetched = await dynadotAPI.getAllTldPrices();
  if (!fetched.success) {
    result.failed.push({ tld: '*', error: fetched.error });
    return result;
  }

  for (const entry of DOMAIN_TLD_PRICES) {
    const tld = entry.value.replace(/^\./, '');
    const price = fetched.prices.get(tld);
    if (!price) {
      result.failed.push({ tld: entry.value, error: 'Extensão não veio na lista de preços da Dynadot' });
      continue;
    }

    if (!isPlausible(entry.price, price.priceUsd) || !isPlausible(entry.renewPrice, price.renewPriceUsd)) {
      result.failed.push({
        tld: entry.value,
        error: `Variação suspeita — a rever à mão: registo $${entry.price}→$${price.priceUsd}, renovação $${entry.renewPrice}→$${price.renewPriceUsd}`,
      });
      continue;
    }

    const { error } = await admin.from('domain_tld_price_overrides').upsert(
      {
        tld: entry.value,
        price_usd: price.priceUsd,
        renew_price_usd: price.renewPriceUsd,
        transfer_price_usd: price.transferPriceUsd ?? null,
        updated_at: new Date().toISOString(),
        source: 'dynadot',
      },
      { onConflict: 'tld' },
    );
    if (error) {
      result.failed.push({ tld: entry.value, error: error.message });
    } else {
      result.updated.push(entry.value);
    }
  }

  return result;
}

export type EffectiveTldPrice = {
  value: string;
  price: number;
  renewPrice: number;
  transfer: number;
  /** Sempre vem da tabela fixa (domain-tld-prices.ts) — o sync da Dynadot só
   * actualiza custos USD, nunca este valor de retalho decidido pelo negócio. */
  fixedPurchasePriceMt?: number;
};

/**
 * Preço efectivo por extensão: usa o valor sincronizado da Dynadot se existir
 * (nunca mais velho que 30 dias — passado isso, prefere o valor fixo do
 * código a arriscar um preço desactualizado sem ninguém reparar), senão cai
 * na tabela fixa (domain-tld-prices.ts).
 */
export async function getEffectiveTldPrices(): Promise<EffectiveTldPrice[]> {
  const base: EffectiveTldPrice[] = DOMAIN_TLD_PRICES.map((t) => ({
    value: t.value,
    price: t.price,
    renewPrice: t.renewPrice,
    transfer: t.transfer,
    fixedPurchasePriceMt: t.fixedPurchasePriceMt,
  }));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return base;

  try {
    const admin = createAdminClient(supabaseUrl, serviceKey);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await admin
      .from('domain_tld_price_overrides')
      .select('tld, price_usd, renew_price_usd, transfer_price_usd, updated_at')
      .gte('updated_at', cutoff);

    if (!data?.length) return base;

    const overrides = new Map(data.map((row) => [row.tld, row]));
    return base.map((entry) => {
      const override = overrides.get(entry.value);
      if (!override) return entry;
      return {
        value: entry.value,
        price: Number(override.price_usd),
        renewPrice: Number(override.renew_price_usd),
        transfer: override.transfer_price_usd !== null ? Number(override.transfer_price_usd) : entry.transfer,
        fixedPurchasePriceMt: entry.fixedPurchasePriceMt,
      };
    });
  } catch {
    return base;
  }
}
