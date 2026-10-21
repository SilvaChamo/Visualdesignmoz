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
  [/^o pacote (.+) não chega para o que a conta (.+) já tem \((.+)\)$/, 'package $1 does not cover what account $2 already has ($3)'],
  [/^o servidor continua a recusar o pacote (.+) para a conta (.+): (.+)$/, 'the server still rejects package $1 for account $2: $3'],
  [/^o pacote foi enviado ao servidor, mas não foi possível confirmar se a conta (.+) passou para (.+): (.+)\. Actualize a lista antes de repetir\.$/, 'the package was sent to the server, but it could not be confirmed whether account $1 switched to $2: $3. Refresh the list before trying again.'],
  [/^o pacote foi enviado ao servidor, mas a resposta de confirmação da conta (.+) não é válida\. Actualize a lista antes de repetir\.$/, 'the package was sent to the server, but the confirmation response for account $1 is invalid. Refresh the list before trying again.'],
  [/^o pacote foi enviado ao servidor, mas não foi possível ler o pacote actual da conta (.+)\. Actualize a lista antes de repetir\.$/, 'the package was sent to the server, but the current package for account $1 could not be read. Refresh the list before trying again.'],
  [/^(\d+) contas no plano · (\d+) restantes$/, '$1 accounts in plan · $2 remaining'],
  [/^(\d+) contas no plano · limite ultrapassado por (\d+)$/, '$1 accounts in plan · over limit by $2'],
  [/^Este plano permite no máximo (\d+) contas de e-mail e já tem (\d+)\.$/, 'This plan allows at most $1 email accounts and already has $2.'],
  [/^A quota pedida não é compatível com o espaço usado e o limite de (\d+) GB do plano\.$/, 'The requested quota is not compatible with the current usage and the plan limit of $1 GB.'],
  [/^Não há espaço suficiente para aumentar esta caixa e manter as outras abaixo de 80% de utilização no plano de (\d+) GB\.$/, 'There is not enough space to increase this mailbox and keep the others below 80% usage within the plan limit of $1 GB.'],
  [/^A soma das quotas não pode exceder (\d+) GB neste plano\. Disponível para esta caixa: (\d+) MB\.$/, 'The total mailbox quotas cannot exceed $1 GB on this plan. Available for this mailbox: $2 MB.'],
  [/^Editar no WordPress$/, 'Edit in WordPress'],
  [/^Editar com Elementor$/, 'Edit with Elementor'],
  [/^Ver a página online$/, 'View page online'],
  [/^A abrir o Elementor…$/, 'Opening Elementor…'],
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
