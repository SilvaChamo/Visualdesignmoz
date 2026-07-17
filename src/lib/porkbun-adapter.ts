/**
 * Adaptador API Porkbun (JSON via POST/GET).
 * Documentação: https://porkbun.com/api/json/v3/documentation
 *
 * Nota importante: a Porkbun regista domínios contra saldo pré-pago da conta
 * (não é cobrado cartão por registo). É necessário ter feito pelo menos um
 * registo manual no site da Porkbun antes de a API de registo funcionar.
 *
 * Nota: as ações de "sair" da Porkbun (obter código de transferência /
 * desbloquear domínio para transferência) NÃO têm endpoint de API público —
 * só estão disponíveis manualmente no painel porkbun.com. As funções
 * correspondentes aqui devolvem um erro explicativo em vez de falharem
 * silenciosamente.
 */

const PORKBUN_API_URL = 'https://api.porkbun.com/api/json/v3';

function getKeys() {
  const apiKey = process.env.PORKBUN_API_KEY;
  const secretKey = process.env.PORKBUN_SECRET_KEY;
  if (!apiKey || !secretKey) return null;
  return { apiKey, secretKey };
}

async function porkbunFetch(path: string, body: Record<string, any> = {}): Promise<Response> {
  const keys = getKeys();
  if (!keys) throw new Error('Chaves de API do registador (Porkbun) não configuradas');

  return fetch(`${PORKBUN_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: keys.apiKey,
      secretapikey: keys.secretKey,
      ...body,
    }),
  });
}

export type PorkbunDomainRow = {
  domain: string;
  status?: string;
  expireDate?: string;
  tld?: string;
  autoRenew?: boolean;
};

export async function checkAvailability(domain: string) {
  const clean = domain.toLowerCase().trim();
  try {
    const res = await porkbunFetch(`/domain/checkDomain/${encodeURIComponent(clean)}`);
    const body = await res.json().catch(() => ({}));

    if (!res.ok || body.status !== 'SUCCESS') {
      return {
        available: false,
        error: body.message || `Erro do registador (${res.status})`,
      };
    }

    const info = body.response || {};
    const available = info.avail === 'yes' || info.available === true;
    // Preço de registo em pennies (cêntimos de USD) — precisamos para o registo.
    const registrationCents =
      info.price != null ? Math.round(parseFloat(info.price) * 100) : undefined;

    return {
      available,
      price: registrationCents != null ? registrationCents / 100 : undefined,
      priceCents: registrationCents,
      currency: 'USD',
    };
  } catch (e: unknown) {
    return {
      available: false,
      error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo (Porkbun)',
    };
  }
}

function mapPorkbunDomain(item: any): PorkbunDomainRow {
  const domain = (item.domain || '').toLowerCase();
  const parts = domain.split('.');
  const tld = parts.length > 1 ? parts.slice(1).join('.') : undefined;
  const expireDate = item.expireDate ? String(item.expireDate).slice(0, 10) : undefined;

  return {
    domain,
    status: item.status,
    expireDate,
    tld,
    autoRenew: item.autoRenew === '1' || item.autoRenew === true || item.autoRenew === 'on',
  };
}

export const porkbunAPI = {
  async listAllDomains(): Promise<
    { success: true; domains: PorkbunDomainRow[] } | { success: false; error: string }
  > {
    if (!getKeys()) {
      return { success: false, error: 'Chaves de API do registador (Porkbun) não configuradas' };
    }

    const domains: PorkbunDomainRow[] = [];
    let start = 0;

    try {
      // Pagina em blocos de até 1000 domínios (limite da API).
      while (true) {
        const res = await porkbunFetch('/domain/listAll', { start });
        const body = await res.json().catch(() => ({}));

        if (!res.ok || body.status !== 'SUCCESS') {
          return { success: false, error: body.message || `Erro do registador (${res.status})` };
        }

        const items = body.domains || [];
        items.forEach((item: any) => domains.push(mapPorkbunDomain(item)));

        if (items.length < 1000) break;
        start += 1000;
      }

      return { success: true, domains };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo (Porkbun)',
      };
    }
  },

  async getDomainDetails(domain: string): Promise<
    | { success: true; isLocked?: boolean; autoRenew?: boolean; expireDate?: string; status?: string }
    | { success: false; error: string }
  > {
    if (!getKeys()) {
      return { success: false, error: 'Chaves de API do registador (Porkbun) não configuradas' };
    }
    try {
      const res = await porkbunFetch(`/domain/listAll`, { domain: domain.toLowerCase() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.status !== 'SUCCESS') {
        return { success: false, error: body.message || `Erro do registador (${res.status})` };
      }
      const item = (body.domains || [])[0];
      if (!item) {
        return { success: false, error: 'Domínio não encontrado na conta Porkbun' };
      }
      return {
        success: true,
        // A Porkbun não expõe "isLocked" na listagem — assumir bloqueado (padrão de segurança)
        // salvo indicação em contrário no próprio painel Porkbun.
        isLocked: undefined,
        autoRenew: item.autoRenew === '1' || item.autoRenew === true || item.autoRenew === 'on',
        expireDate: item.expireDate ? String(item.expireDate).slice(0, 10) : undefined,
        status: item.status,
      };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo (Porkbun)' };
    }
  },

  /**
   * Não suportado pela API pública da Porkbun. Obter o código de
   * transferência (EPP) tem de ser feito manualmente em porkbun.com,
   * na página do domínio, através do botão "Get Authorization Code".
   */
  async getTransferAuthCode(_domain: string): Promise<
    { success: true; authCode: string; expires?: string } | { success: false; error: string }
  > {
    return {
      success: false,
      error:
        'A Porkbun não disponibiliza esta ação pela API. Obtenha o código de transferência manualmente em porkbun.com → Domain Management → Details → Get Authorization Code.',
    };
  },

  /**
   * Não suportado pela API pública da Porkbun. O bloqueio/desbloqueio de
   * transferência tem de ser feito manualmente em porkbun.com (ícone de
   * cadeado junto ao domínio).
   */
  async setTransferLock(
    _domain: string,
    _isLocked: boolean,
  ): Promise<{ success: true; isLocked: boolean } | { success: false; error: string }> {
    return {
      success: false,
      error:
        'A Porkbun não disponibiliza esta ação pela API. Bloqueie/desbloqueie manualmente em porkbun.com → Domain Management (ícone de cadeado).',
    };
  },

  async setAutoRenew(
    domain: string,
    isEnabled: boolean,
  ): Promise<{ success: true; isEnabled: boolean } | { success: false; error: string }> {
    if (!getKeys()) {
      return { success: false, error: 'Chaves de API do registador (Porkbun) não configuradas' };
    }
    try {
      const res = await porkbunFetch(`/domain/updateAutoRenew/${encodeURIComponent(domain.toLowerCase())}`, {
        status: isEnabled ? 'on' : 'off',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.status !== 'SUCCESS') {
        return { success: false, error: body.message || `Erro do registador (${res.status})` };
      }
      return { success: true, isEnabled };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo (Porkbun)' };
    }
  },

  /**
   * Regista um domínio usando o saldo pré-pago da conta Porkbun.
   * IMPORTANTE: a Porkbun exige que o custo enviado corresponda EXATAMENTE
   * ao preço atual (obtido via checkAvailability) — por isso chamamos
   * checkAvailability aqui dentro para garantir o valor correto no momento
   * do registo, mesmo que o preço tenha mudado entretanto.
   * A informação de contacto WHOIS não é enviada por domínio — é usada a
   * configurada na conta Porkbun (Account Settings → Contact Information).
   */
  async registerDomain(
    domain: string,
  ): Promise<{ success: true; message: string; orderId?: number; raw?: any } | { success: false; error: string; raw?: any }> {
    if (!getKeys()) {
      return { success: false, error: 'Chaves de API do registador (Porkbun) não configuradas' };
    }
    const clean = domain.toLowerCase().trim();
    try {
      const check = await checkAvailability(clean);
      if (!check.available || check.priceCents == null) {
        return { success: false, error: check.error || 'Domínio não disponível ou sem preço obtido.' };
      }

      const res = await porkbunFetch(`/domain/create/${encodeURIComponent(clean)}`, {
        cost: check.priceCents,
        agreeToTerms: 'yes',
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.status !== 'SUCCESS') {
        const errorDetail = body.message || `Erro do registador (${res.status})`;
        return { success: false, error: errorDetail, raw: body };
      }

      return {
        success: true,
        message: `Domínio ${clean} registado com sucesso na Porkbun.`,
        orderId: body.orderId,
        raw: body,
      };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Erro ao contactar o serviço de registo (Porkbun)' };
    }
  },
};
