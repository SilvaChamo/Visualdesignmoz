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
  [/^o pacote (.+) é mais pequeno do que o que a conta (.+) já usa \(domínios, e-mails ou bases de dados\)$/, 'package $1 is smaller than what account $2 currently uses (domains, emails, or databases)'],
  [/^o servidor continua a recusar o pacote (.+) para a conta (.+): (.+)$/, 'the server still rejects package $1 for account $2: $3'],
  [/^o pacote foi enviado ao servidor, mas não foi possível confirmar se a conta (.+) passou para (.+): (.+)\. Actualize a lista antes de repetir\.$/, 'the package was sent to the server, but it could not be confirmed whether account $1 switched to $2: $3. Refresh the list before trying again.'],
  [/^o pacote foi enviado ao servidor, mas a resposta de confirmação da conta (.+) não é válida\. Actualize a lista antes de repetir\.$/, 'the package was sent to the server, but the confirmation response for account $1 is invalid. Refresh the list before trying again.'],
  [/^o pacote foi enviado ao servidor, mas não foi possível ler o pacote actual da conta (.+)\. Actualize a lista antes de repetir\.$/, 'the package was sent to the server, but the current package for account $1 could not be read. Refresh the list before trying again.'],
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
