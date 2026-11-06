/**
 * /webmail nos sites que estão na Vercel (Silva, 06/11/2026).
 *
 * Um site na Vercel não tem a rota <domínio>/webmail (o Roundcube corre no servidor de e-mail), e dava 404. Ao reprocessar o DNS o
 * painel põe lá a regra, sem ninguém fundir nada à mão: vê se o site já redireciona; senão descobre o projecto da Vercel que tem o
 * domínio (chave VERCEL_TOKEN) e o repositório do GitHub dele, e acrescenta a regra ao vercel.json por esse repositório (chave
 * GITHUB_TOKEN_SITES). A Vercel publica o site sozinha com o commit. Passa pelo GitHub porque a API de redirects da Vercel só existe nos
 * planos pagos e não aceita "/webmail/qualquer-coisa".
 */

export type ResultadoWebmailVercel = { estado: 'certo' | 'novo' | 'falhou'; detalhe?: string };

const DOM = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

async function pedir<T>(url: string, token: string, init?: RequestInit): Promise<{ ok: boolean; status: number; json: T | null }> {
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'visualdesign-painel', ...(init?.headers || {}) },
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });
  const json = (await r.json().catch(() => null)) as T | null;
  return { ok: r.ok, status: r.status, json };
}

/** O site já redireciona /webmail para um webmail? (nesse caso não há nada a fazer) */
async function jaRedireciona(d: string): Promise<boolean> {
  try {
    const r = await fetch(`https://${d}/webmail`, { redirect: 'manual', signal: AbortSignal.timeout(12_000), cache: 'no-store' });
    const loc = r.headers.get('location') || '';
    return r.status >= 300 && r.status < 400 && /^https?:\/\/webmail\./i.test(loc);
  } catch {
    return false;
  }
}

type ProjetoVercel = { id: string; name: string; link?: { type?: string; org?: string; repo?: string; productionBranch?: string } };

/** O projecto da Vercel que tem este domínio (ou o www dele) */
async function projetoDoDominio(d: string, token: string): Promise<ProjetoVercel | { erro: string }> {
  const projetos: ProjetoVercel[] = [];
  let de = '';
  for (let pagina = 0; pagina < 5; pagina++) {
    const r = await pedir<{ projects?: ProjetoVercel[]; pagination?: { next?: number | string | null } } | ProjetoVercel[]>(
      `https://api.vercel.com/v10/projects?limit=100${de ? '&from=' + encodeURIComponent(de) : ''}`,
      token,
    );
    if (r.status === 401 || r.status === 403) return { erro: 'a chave da Vercel não foi aceite' };
    if (!r.ok || !r.json) return { erro: 'a Vercel não respondeu (' + r.status + ')' };
    const lista = Array.isArray(r.json) ? r.json : r.json.projects || [];
    projetos.push(...lista);
    const seguinte = Array.isArray(r.json) ? null : r.json.pagination?.next;
    if (!seguinte || lista.length === 0) break;
    de = String(seguinte);
  }
  const nomes = new Set([d, `www.${d}`]);
  for (const p of projetos) {
    const r = await pedir<{ domains?: { name: string }[] }>(`https://api.vercel.com/v9/projects/${encodeURIComponent(p.id)}/domains?limit=100`, token);
    if (r.ok && r.json?.domains?.some((x) => nomes.has(String(x.name).toLowerCase()))) return p;
  }
  return { erro: 'não encontrei na Vercel nenhum projecto com o domínio ' + d };
}

type Redirecionamento = { source: string; destination: string; permanent?: boolean; statusCode?: number };

/**
 * Garante que https://<d>/webmail abre o webmail: não faz nada se o site já redireciona; senão acrescenta a regra ao vercel.json do repositório do
 * site. `destino` é o endereço do webmail (https://webmail.<d>/ quando esse nome tem SSL; senão o webmail do painel).
 */
export async function garantirWebmailNaVercel(dominio: string, destino: string): Promise<ResultadoWebmailVercel> {
  const d = dominio.trim().toLowerCase();
  if (!DOM.test(d)) return { estado: 'falhou', detalhe: 'domínio inválido' };
  if (await jaRedireciona(d)) return { estado: 'certo', detalhe: `${d}/webmail já redireciona para o webmail` };

  const vToken = (process.env.VERCEL_TOKEN || '').trim();
  const gToken = (process.env.GITHUB_TOKEN_SITES || '').trim();
  if (!vToken) return { estado: 'falhou', detalhe: 'falta a chave da Vercel no servidor (VERCEL_TOKEN)' };
  if (!gToken) return { estado: 'falhou', detalhe: 'falta a chave do GitHub no servidor (GITHUB_TOKEN_SITES)' };

  const p = await projetoDoDominio(d, vToken);
  if ('erro' in p) return { estado: 'falhou', detalhe: p.erro };
  const org = p.link?.org;
  const repo = p.link?.repo;
  if (p.link?.type !== 'github' || !org || !repo) return { estado: 'falhou', detalhe: `o projecto ${p.name} da Vercel não está ligado a um repositório do GitHub` };
  const ramo = p.link?.productionBranch || 'main';

  const gh = (caminho: string, init?: RequestInit) =>
    pedir<Record<string, unknown>>(`https://api.github.com/repos/${org}/${repo}/${caminho}`, gToken, { ...init, headers: { Accept: 'application/vnd.github+json', ...(init?.headers || {}) } });

  // vercel.json actual (se houver)
  const atual = await gh(`contents/vercel.json?ref=${encodeURIComponent(ramo)}`);
  let conteudo: Record<string, unknown> = {};
  let sha: string | undefined;
  if (atual.status === 200 && atual.json) {
    sha = String(atual.json.sha || '');
    try {
      conteudo = JSON.parse(Buffer.from(String(atual.json.content || ''), 'base64').toString('utf8')) as Record<string, unknown>;
    } catch {
      return { estado: 'falhou', detalhe: `o vercel.json de ${org}/${repo} não é um JSON válido` };
    }
  } else if (atual.status !== 404) {
    // 404 = ainda não há vercel.json (cria-se); qualquer outra resposta é um problema de acesso
    return { estado: 'falhou', detalhe: `o GitHub não deixou ler ${org}/${repo} (${atual.status}): confira a chave GITHUB_TOKEN_SITES` };
  }
  if (Array.isArray(conteudo.routes)) return { estado: 'falhou', detalhe: `o vercel.json de ${org}/${repo} usa "routes", que não se mistura com redirects: acrescente a regra à mão` };

  const regras: Redirecionamento[] = Array.isArray(conteudo.redirects) ? (conteudo.redirects as Redirecionamento[]) : [];
  if (regras.some((x) => x.source === '/webmail/:path*' || x.source === '/webmail')) {
    return { estado: 'certo', detalhe: `${org}/${repo} já tem a regra /webmail (a Vercel ainda a está a publicar)` };
  }
  regras.push({ source: '/webmail/:path*', destination: destino, permanent: false });
  conteudo.redirects = regras;

  const gravar = await gh('contents/vercel.json', {
    method: 'PUT',
    body: JSON.stringify({
      message: 'Abrir o webmail em /webmail: redirecionar para o Roundcube do servidor de e-mail',
      content: Buffer.from(JSON.stringify(conteudo, null, 2) + '\n', 'utf8').toString('base64'),
      branch: ramo,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!gravar.ok) return { estado: 'falhou', detalhe: `o GitHub recusou gravar em ${org}/${repo} (${gravar.status}): a chave precisa de permissão de escrita nesse repositório` };
  return { estado: 'novo', detalhe: `regra posta em ${org}/${repo}; o site publica-se em 1 a 2 minutos` };
}
