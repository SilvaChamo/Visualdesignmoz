/**
 * Tradução de texto para o botão «Traduzir» do VhostMail (rota /api/vhost/traduzir): Google Cloud Translation se
 * GOOGLE_TRANSLATE_API_KEY estiver definida e, sem chave, o MyMemory (gratuito, detecta a língua).
 */
export const MAX_TOTAL = 8_000;
const PEDACO = 450;

/** Parte um texto em pedaços de até `max` caracteres, cortando em linhas e frases para não partir palavras */
export function pedacos(t: string, max = PEDACO): string[] {
  const out: string[] = [];
  let atual = '';
  const junta = (x: string) => {
    if (atual && atual.length + x.length > max) (out.push(atual), (atual = ''));
    atual += x;
  };
  for (const linha of t.split(/(?<=\n)/)) {
    if (linha.length <= max) junta(linha);
    else
      for (const f of linha.split(/(?<=[.!?;])\s+/)) {
        if (f.length <= max) junta(f + ' ');
        else for (let i = 0; i < f.length; i += max) junta(f.slice(i, i + max));
      }
  }
  if (atual) out.push(atual);
  return out;
}

export type Res = { texto: string; idioma: string };

async function googleOficial(texto: string, para: string, chave: string): Promise<Res> {
  const r = await fetch('https://translation.googleapis.com/language/translate/v2?key=' + encodeURIComponent(chave), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texto, target: para, format: 'text' }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error('O tradutor não respondeu (' + r.status + ').');
  const j = (await r.json()) as { data?: { translations?: { translatedText: string; detectedSourceLanguage?: string }[] } };
  const t = j.data?.translations?.[0];
  if (!t) throw new Error('O tradutor não devolveu texto.');
  return { texto: t.translatedText, idioma: t.detectedSourceLanguage || '' };
}

/** Um pedaço pelo MyMemory. Já em português: o próprio MyMemory recusa «duas línguas iguais» → devolve o texto como está */
async function myMemory(pedaco: string, para: string): Promise<Res> {
  const destino = para === 'pt' ? 'pt-PT' : para;
  const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(pedaco) + '&langpair=' + encodeURIComponent('Autodetect|' + destino), { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error('O tradutor não respondeu (' + r.status + ').');
  const j = (await r.json()) as { responseStatus?: number | string; responseData?: { translatedText?: string; detectedLanguage?: string | null }; responseDetails?: string };
  const estado = Number(j.responseStatus);
  const t = j.responseData?.translatedText || '';
  if (/MYMEMORY WARNING|USED ALL AVAILABLE/i.test(t) || /MYMEMORY WARNING|USED ALL AVAILABLE/i.test(j.responseDetails || '') || estado === 429)
    throw new Error('Foi atingido o limite diário do tradutor gratuito. Tente amanhã ou peça ao administrador para ligar o tradutor do Google (GOOGLE_TRANSLATE_API_KEY).');
  if (estado === 403 && /DISTINCT LANGUAGES/i.test(t + (j.responseDetails || ''))) return { texto: pedaco, idioma: para.slice(0, 2) };
  if (estado !== 200 || !t) throw new Error('O tradutor não devolveu texto.');
  return { texto: t, idioma: String(j.responseData?.detectedLanguage || '').slice(0, 2) };
}

export async function traduzir(texto: string, para: string): Promise<Res> {
  if (!texto.trim()) return { texto, idioma: '' };
  const chave = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  if (chave) return googleOficial(texto, para, chave);
  const ps = pedacos(texto);
  const res: Res[] = [];
  // em grupos de 4 pedidos de cada vez, para não demorar numa mensagem comprida
  for (let i = 0; i < ps.length; i += 4) res.push(...(await Promise.all(ps.slice(i, i + 4).map((p) => myMemory(p, para)))));
  return { texto: res.map((r) => r.texto).join(''), idioma: res.map((r) => r.idioma).find(Boolean) || '' };
}

