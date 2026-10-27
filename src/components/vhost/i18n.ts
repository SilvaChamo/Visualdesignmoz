// Idiomas: Português (base) e English. Como na maquete, os textos conhecidos são trocados
// (dicionário EN + algumas frases com partes variáveis); o resto fica em português.
import { EN } from './generated/data';
import './traducoes';

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
  [/^Mudar nome$/, 'Rename'],
  [/^Opções$/, 'Options'],
  [/^Mudar nome da página$/, 'Rename page'],
  [/^Página renomeada$/, 'Page renamed'],
];

// Frases com partes variáveis escritas no dicionário como «{0}», «{1}»… ("Apagar {0} contas": "Delete {0} accounts"): viram
// expressões regulares, feitas uma vez e refeitas só se o dicionário crescer (as páginas acrescentam as suas linhas ao carregar).
let modelos: { re: RegExp; en: string }[] = [];
let normais = new Map<string, string>();
let tamanho = -1;
const normal = (x: string) => x.replace(/\s+/g, ' ').trim();
function preparar() {
  const chaves = Object.keys(EN);
  if (chaves.length === tamanho) return;
  tamanho = chaves.length;
  modelos = [];
  normais = new Map();
  // o modelo com mais texto fixo primeiro: «Palavra-passe de {0} mudada» antes de «Palavra-passe de {0}»
  chaves.sort((a, b) => b.replace(/\{\d\}/g, '').length - a.replace(/\{\d\}/g, '').length);
  for (const pt of chaves) {
    const k = normal(pt);
    if (/\{\d\}/.test(k)) {
      const fonte = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d)\\?\}/g, '(?<v$1>[\\s\\S]+?)');
      modelos.push({ re: new RegExp('^' + fonte + '$'), en: EN[pt] });
    } else if (!normais.has(k)) normais.set(k, EN[pt]);
  }
}

export function translate(lang: Lang, v: string): string {
  if (lang !== 'en') return v;
  const t = v.trim();
  if (!t) return v;
  let r: string | undefined = EN[t];
  if (r === undefined) {
    preparar();
    const n = normal(t);
    r = normais.get(n);
    if (r === undefined) {
      for (const m of modelos) {
        const g = m.re.exec(n);
        if (g) {
          r = m.en.replace(/\{(\d)\}/g, (_x, i) => g.groups?.['v' + i] ?? '');
          break;
        }
      }
    }
  }
  if (r === undefined) {
    for (const [rx, rep] of EN_RX) {
      if (rx.test(t)) {
        r = typeof rep === 'string' ? t.replace(rx, rep) : t.replace(rx, rep);
        break;
      }
    }
  }
  return r === undefined ? v : v.replace(t, () => r as string);
}
