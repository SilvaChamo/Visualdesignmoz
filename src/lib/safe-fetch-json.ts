/** Evita SyntaxError quando a API devolve HTML (timeout, erro Vercel, redirect). */
export async function parseJsonResponse<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) return {} as T;
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<')) {
    throw new Error(`Resposta inválida do servidor (${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Resposta inválida do servidor (${res.status})`);
  }
}
