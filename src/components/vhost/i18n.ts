// Idiomas: Português (base) e English. Como na maquete, os textos conhecidos são trocados
// (dicionário EN + algumas frases com partes variáveis); o resto fica em português.
import { EN } from './generated/data';

export type Lang = 'pt' | 'en';

type Rep = string | ((match: string, ...groups: string[]) => string);
const EN_RX: [RegExp, Rep][] = [
  [/^Olá, (.+)$/, 'Hello, $1'],
  [/^· (Administrador|Revendedor|Profissional|Cliente)(.*)$/, (_m, r, rest) => '· ' + EN[r] + rest],
  [/^(\d+) de (\d+) contas$/, '$1 of $2 accounts'],
  [/^(.+) · (\d+) clientes$/, '$1 · $2 users'],
  [/^(\d+) domínios · (\d+) e-mails · nível Utilizador$/, '$1 domains · $2 e-mails · User level'],
  [/^(.+) — (Administrador|Revendedor|Profissional|Cliente)(.*)$/, (_m, n, r, rest) => n + ' — ' + EN[r] + rest],
];

export function translate(lang: Lang, v: string): string {
  if (lang !== 'en') return v;
  const t = v.trim();
  if (!t) return v;
  let r: string | undefined = EN[t];
  if (r === undefined) {
    for (const [rx, rep] of EN_RX) {
      if (rx.test(t)) {
        r = typeof rep === 'string' ? t.replace(rx, rep) : t.replace(rx, rep);
        break;
      }
    }
  }
  return r === undefined ? v : v.replace(t, r);
}
