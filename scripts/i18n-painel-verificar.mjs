#!/usr/bin/env node
// Verifica as traduções do PAINEL (src/components/vhost e src/app/vhost) — pedido do Silva, 27/10/2026: «tem muitas páginas
// não traduzidas no painel… espero que não tenha nenhuma página fora da tradução».
//
//   node scripts/i18n-painel-verificar.mjs          → resumo por ficheiro
//   node scripts/i18n-painel-verificar.mjs -v       → também cada texto
//   node scripts/i18n-painel-verificar.mjs ficheiro → só esse ficheiro (com os textos)
//   node scripts/i18n-painel-verificar.mjs --json   → a lista em falta (texto → ficheiro:linha)
//
// O painel traduz-se por `translate()` (src/components/vhost/i18n.ts): dicionário `EN` (generated/data.ts + as
// linhas `novas` de cada página) e as frases com partes variáveis `EN_RX`. A TraducaoPainel (a rede de segurança) aplica
// o mesmo dicionário a todo o texto que chega ao ecrã, mesmo o que não passa por `t()`. Este verificador lista os textos
// em português do código do painel que não têm inglês no dicionário. Sai com código 1 quando falta alguma coisa.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(path.join(raiz, 'package.json'));
let ts;
try {
  ts = require('typescript');
} catch {
  ts = createRequire('/opt/node22/lib/node_modules/')('typescript');
}

// --api acrescenta as rotas e bibliotecas do painel: as mensagens que devolvem aparecem no ecrã (avisos, erros)
const PASTAS = ['src/components/vhost', 'src/app/vhost', ...(process.argv.includes('--api') ? ['src/app/api/vhost'] : [])];
const IGNORAR = [/\/generated\//, /\/traducoes\//, /\/i18n\.ts$/, /\.d\.ts$/, /\/TemaScript\.tsx$/, /\/types\.ts$/];

function ficheiros() {
  const out = [];
  const andar = (d) => {
    for (const e of fs.readdirSync(path.join(raiz, d), { withFileTypes: true })) {
      const rel = path.posix.join(d, e.name);
      if (e.isDirectory()) andar(rel);
      else if (/\.tsx?$/.test(e.name) && !IGNORAR.some((r) => r.test(rel))) out.push(rel);
    }
  };
  for (const p of PASTAS) andar(p);
  // componentes e listas partilhados que se desenham dentro do painel (importados pelas páginas do painel)
  if (process.argv.includes('--api')) {
    const pasta = (d, re = /\.tsx?$/) => {
      for (const e of fs.readdirSync(path.join(raiz, d), { withFileTypes: true })) {
        const r = path.posix.join(d, e.name);
        if (e.isDirectory()) pasta(r, re);
        else if (re.test(e.name)) out.push(r);
      }
    };
    for (const d of ['src/components/checkout', 'src/components/cotacao', 'src/components/documents', 'src/components/encomendas', 'src/components/quotations']) pasta(d);
    out.push('src/components/DomainSearchPainel.tsx', 'src/components/RichTextEditor.tsx', 'src/components/panel/MoveToAccountModal.tsx', 'src/app/checkout/EncomendaCheckoutParts.tsx', 'src/app/checkout/RenewalCheckout.tsx');
    for (const n of ['quotation-status-labels', 'pricing-catalog', 'email-plans', 'hosting-plans', 'package-catalog', 'checkout-item-labels', 'quotation-payment-info', 'panel-ui', 'reseller-package-form', 'user-products', 'domain-redemption', 'quotation-batch', 'renewal-templates', 'email-client-config-export', 'php-extensoes', 'pacote-hestia', 'visualdesign-dns', 'use-batch-numeros']) out.push(`src/lib/${n}.ts`);
  }
  // bibliotecas do painel (src/lib/vhost-*.ts): também devolvem mensagens que aparecem no ecrã
  if (process.argv.includes('--api')) for (const n of fs.readdirSync(path.join(raiz, 'src/lib'))) if (/^vhost-.*\.ts$/.test(n)) out.push('src/lib/' + n);
  return out.sort();
}

// por defeito apanha também as palavras soltas em minúsculas ("ex.: loja"); --so-rotulos volta à regra antiga (só as que começam por maiúscula)
const AGRESSIVO = !process.argv.includes('--so-rotulos');
const normal = (s) => s.replace(/\s+/g, ' ').trim();

const PALAVRAS_PT =
  /\b(de|da|do|das|dos|para|com|não|nós|nosso|nossa|nossos|nossas|seu|sua|seus|suas|em|uma|um|os|as|que|mais|são|está|ao|aos|na|no|nas|nos|pelo|pela|até|também|sem|ou|é|e|o|por|como|todos|todas|já|ver|saiba|pedir|enviar|contacte|serviços?|preços?|empresa|cliente|grátis|gratuito|nenhum|nenhuma|erro|guardar|apagar|criar|editar|adicionar|ficheiros?|domínios?|conta|contas|mensagem|mensagens|pagamento|renovação|renovações|selecione|escolha|obrigatório)\b|ção|ções|ões|ã|õ|ç|á|é|í|ó|ú|â|ê|ô/i;
function pareceTexto(s) {
  const t = normal(s);
  if (t.length < 2 || !/[a-zà-ú]{2}/i.test(t)) return false;
  if (/^(https?:|mailto:|tel:|\/|#|\.|@)/.test(t)) return false;
  if (/^(--|var\(|hsl|rgb|-----BEGIN|\|\w+\|$)/.test(t) || /^[\w.*#:\[\]="'-]+(,\s*[\w.*#:\[\]="'-]+)+$/.test(t) && !/\s[a-zà-ú]{3}/i.test(t)) return false; // CSS, tokens, chaves, listas de selectores
  if (/\b(echo|grep|chown|chmod|mkdir|awk|sed|openssl|v-[a-z-]+)\b.*[;|&$]|^(SELECT|INSERT|UPDATE|DELETE) /.test(t)) return false; // comandos de shell e SQL
  if (/\{\{\w+\}\}/.test(t)) return false; // texto-base das mensagens enviadas aos clientes ({{serviceName}}…): conteúdo, não a interface
  if (/<\/?[a-z!][^>]*>/i.test(t)) return false; // HTML (modelos de e-mail, editores)
  if (/^[\w-]+(\s+[\w:/[\].%#()!-]+)*$/.test(t) && /(^|\s)(flex|grid|text-|bg-|px-|py-|w-|h-|rounded|border|items-|justify-|gap-|font-|hidden|block|absolute|relative|fa-|fa$|btn|mt-|mb-|ml-|mr-|p-|m-|space-|overflow|min-|max-|cursor|transition|hover:|focus:|dark:|sm:|md:|lg:)/.test(t)) return false;
  if (/^[a-z][\w.-]*$/.test(t) && !/[à-ú]/i.test(t)) return false;
  if (/^[a-z0-9-]+(\/[a-z0-9-]+)+$/.test(t)) return false; // rotas (utilizador/ficheiros)
  if (!PALAVRAS_PT.test(t)) {
    if (/[{}<>=;$]|=>|\(\)/.test(t) || /^[A-Z0-9_]+$/.test(t) || /^[\w-]+\.(tsx?|jsx?|png|jpe?g|webp|svg|pdf|css|json)$/.test(t)) return false;
    if (/^[a-z][a-zA-Z0-9]*$/.test(t)) return false;
    if (/^[A-Z][a-z]+[A-Z]\w*$/.test(t) || /^[A-Z]{2,}-[\w-]+$/.test(t) || /^\d+-\w+$/.test(t)) return false;
    if (/^(polygon|calc|rgba?|url)\(|^\(|\[[^\]]*\]|^[\w-]+:$/.test(t)) return false;
    if (/^[0-9][\w]{15,}$/.test(t)) return false;
    if (/^[a-z0-9-]+(\s[a-z0-9:/[\].%#()-]+)+$/.test(t)) return false;
    // palavras soltas só se começam por maiúscula (rótulos); "text", "button"… são código
    if (!AGRESSIVO && !/^[A-ZÀ-Ú]/.test(t)) return false;
  }
  return /[A-ZÀ-Úa-zà-ú]{3}/.test(t);
}

const ATRIBUTOS_FORA = new Set(['className', 'href', 'src', 'id', 'key', 'type', 'name', 'style', 'target', 'rel', 'role', 'as', 'variant', 'size', 'sizes', 'value', 'autoComplete', 'inputMode', 'pattern', 'method', 'action', 'htmlFor', 'fill', 'stroke', 'd', 'viewBox', 'data-theme', 'lang', 'accept', 'defaultValue', 'for', 'width', 'height', 'color', 'transform', 'cx', 'cy', 'r', 'points', 'xmlns', 'data-sem-traducao']);

function ignorar(no) {
  for (let p = no.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const n = p.expression.getText();
      if (/^(console\.|cn$|clsx$|twMerge$|require$|fetch$|encodeURIComponent$|new URL$|redirect$|router\.|.*\.(push|replace|replaceAll|startsWith|endsWith|includes|split|join|test|match|get|set|eq|from|select|order|filter|querySelector|querySelectorAll|closest|getElementById|getItem|setItem|removeItem|addEventListener|removeEventListener|classList\.\w+|setAttribute|getAttribute|includes|indexOf|has|append|delete|rpc|insert|update|ilike|like|in|or|not|is|neq|gt|lt|gte|lte|createElement|dispatchEvent|postMessage|fromCharCode)|ts\.\w+)$/.test(n)) return true;
    }
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    if (ts.isJsxAttribute(p)) {
      const n = p.name.getText();
      if (ATRIBUTOS_FORA.has(n) || n === 'dangerouslySetInnerHTML' || /^data-/.test(n) && n !== 'data-tip') return true;
    }
    if (ts.isPropertyAssignment(p)) {
      const n = p.name.getText().replace(/['"]/g, '');
      if (/^(en|className|class|href|src|image|img|icon|fa|slug|id|key|url|link|path|color|bg|cor|keywords|tags|__html|cmd|s|c|da|feat|hx|api|endpoint|method|headers|Authorization|Content-Type|accept|selector|sel|fn|font|fontFamily|display|position|width|height|top|left|right|bottom|margin|padding|border|background|transform|transition|cursor|overflow|opacity|zIndex|textAlign|flex|gap|grid)$/i.test(n)) return true;
    }
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind)) return true;
    if (ts.isCaseClause(p)) return true;
    if (ts.isElementAccessExpression(p) && p.argumentExpression === no) return true;
    if (ts.isNewExpression(p) && /^(Error|RegExp|URL|URLSearchParams|Date|Set|Map)$/.test(p.expression.getText())) return true;
    if (ts.isThrowStatement(p)) return true;
    if (ts.isTypeNode(p) || ts.isTypeAliasDeclaration(p) || ts.isInterfaceDeclaration(p) || ts.isLiteralTypeNode(p)) return true;
    if (ts.isTaggedTemplateExpression(p)) return true; // css`…`, sql`…`
    if (ts.isJsxElement(p)) {
      const tag = p.openingElement.tagName.getText();
      if (/^(style|script|code|pre|textarea)$/.test(tag)) return true;
    }
    if (ts.isComputedPropertyName(p)) return true;
  }
  return false;
}

const entidades = (s) =>
  s.replace(/&(quot|amp|apos|lt|gt|nbsp|#39|mdash|ndash|hellip|middot);/g, (_, e) => ({ quot: '"', amp: '&', apos: "'", lt: '<', gt: '>', nbsp: ' ', '#39': "'", mdash: '—', ndash: '–', hellip: '…', middot: '·' })[e]);

function analisar(rel) {
  const src = fs.readFileSync(path.join(raiz, rel), 'utf8');
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const textos = [];
  const jaFeitos = new WeakSet();
  // 'Texto ' + x + ' mais texto' → um só modelo "Texto {0} mais texto" (é assim que o texto chega ao ecrã)
  const achatar = (no, out) => {
    if (ts.isBinaryExpression(no) && no.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      achatar(no.left, out);
      achatar(no.right, out);
    } else if (ts.isParenthesizedExpression(no) && ts.isBinaryExpression(no.expression) && no.expression.operatorToken.kind === ts.SyntaxKind.PlusToken) achatar(no.expression, out);
    else out.push(no);
    return out;
  };
  const visitar = (no) => {
    let texto = null;
    let variavel = false;
    if (ts.isBinaryExpression(no) && no.operatorToken.kind === ts.SyntaxKind.PlusToken && !jaFeitos.has(no)) {
      const partes = achatar(no, []);
      const literais = partes.filter((x) => ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x));
      if (literais.length && partes.length > literais.length) {
        let i = 0;
        const modelo = partes.map((x) => (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x) ? x.text : `{${i++}}`)).join('');
        // marca as folhas da cadeia: não se repetem como fragmentos soltos
        const marcar = (n) => {
          jaFeitos.add(n);
          if (ts.isBinaryExpression(n)) (marcar(n.left), marcar(n.right));
          else if (ts.isParenthesizedExpression(n)) marcar(n.expression);
        };
        marcar(no);
        for (const l of literais) jaFeitos.add(l);
        if (pareceTexto(modelo.replace(/\{\d+\}/g, ' ')) && !ignorar(no)) {
          textos.push({ texto: normal(modelo), variavel: true, linha: sf.getLineAndCharacterOfPosition(no.getStart()).line + 1 });
        }
        ts.forEachChild(no, visitar);
        return;
      }
    }
    if ((ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) && jaFeitos.has(no)) return;
    if (ts.isJsxText(no)) texto = entidades(no.getText());
    else if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) texto = no.text;
    else if (ts.isTemplateExpression(no)) {
      texto = no.head.text + no.templateSpans.map((s, i) => `{${i}}` + s.literal.text).join('');
      variavel = true;
    }
    if (texto != null && pareceTexto(texto) && !ignorar(no)) {
      textos.push({ texto: normal(texto), variavel, linha: sf.getLineAndCharacterOfPosition(no.getStart()).line + 1 });
    }
    ts.forEachChild(no, visitar);
  };
  visitar(sf);
  return textos;
}

// ---- O dicionário: chaves (português) e valores (inglês) de todos os pares "texto": "text" do painel ----
const todos = ficheiros();
const comIngles = new Set();
const valoresEn = new Set();
const fontesDic = [
  ...todos,
  'src/components/vhost/generated/data.ts',
  ...fs.readdirSync(path.join(raiz, 'src/components/vhost/traducoes')).filter((n) => /\.ts$/.test(n)).map((n) => 'src/components/vhost/traducoes/' + n),
];
for (const f of fontesDic) {
  const sf = ts.createSourceFile(f, fs.readFileSync(path.join(raiz, f), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const v = (n) => {
    if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.name) || ts.isNoSubstitutionTemplateLiteral(n.name)) && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) {
      comIngles.add(normal(n.name.text));
      valoresEn.add(normal(n.initializer.text));
    }
    // lista de textos iguais nas duas línguas (traducoes/iguais.ts)
    if (ts.isVariableDeclaration(n) && n.name.getText() === 'IGUAIS' && n.initializer && ts.isArrayLiteralExpression(n.initializer)) {
      for (const e of n.initializer.elements) if (ts.isStringLiteral(e)) comIngles.add(normal(e.text));
    }
    // pares [pt, en] (TITULOS, DESC…)
    if (ts.isArrayLiteralExpression(n) && n.elements.length === 2 && n.elements.every((e) => ts.isStringLiteral(e))) {
      comIngles.add(normal(n.elements[0].text));
      valoresEn.add(normal(n.elements[1].text));
    }
    ts.forEachChild(n, v);
  };
  v(sf);
}
// o dicionário do site público (src/lib/i18n-textos.ts): a TraducaoPainel usa-o em segundo lugar, para os componentes partilhados com o site
{
  const sf = ts.createSourceFile('t.ts', fs.readFileSync(path.join(raiz, 'src/lib/i18n-textos.ts'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const v = (n) => {
    if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.name) || ts.isNoSubstitutionTemplateLiteral(n.name)) && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) {
      comIngles.add(normal(n.name.text));
      valoresEn.add(normal(n.initializer.text));
    }
    if (ts.isArrayLiteralExpression(n)) for (const e of n.elements) if (ts.isStringLiteral(e)) comIngles.add(normal(e.text));
    ts.forEachChild(n, v);
  };
  v(sf);
}
// frases com partes variáveis (EN_RX de i18n.ts)
const RX = [];
{
  const src = fs.readFileSync(path.join(raiz, 'src/components/vhost/i18n.ts'), 'utf8');
  for (const m of src.matchAll(/^\s*\[\/(.+)\/,\s/gm)) {
    try {
      RX.push(new RegExp(m[1]));
    } catch {}
  }
}
// modelos "{0}" do dicionário viram expressões regulares
const MODELOS = [...comIngles].filter((k) => /\{\d\}/.test(k)).map((k) => new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d)\\?\}/g, '.+?') + '$'));

function traduzido(t) {
  if (comIngles.has(t) || valoresEn.has(t)) return true;
  if (RX.some((r) => r.test(t))) return true;
  if (MODELOS.some((r) => r.test(t))) return true;
  return false;
}

const args = process.argv.slice(2);
const detalhe = args.includes('-v');
const json = args.includes('--json');
const so = args.filter((a) => !a.startsWith('-')).map((a) => path.relative(raiz, path.resolve(a)).split(path.sep).join('/'));
const lista = so.length ? so : todos;

let falta = 0;
const emFalta = new Map();
for (const f of lista) {
  const semEn = analisar(f).filter((x) => !traduzido(x.texto));
  if (!semEn.length) continue;
  falta += semEn.length;
  for (const x of semEn) if (!emFalta.has(x.texto)) emFalta.set(x.texto, f + ':' + x.linha);
  if (json) continue;
  console.log(`${f}: ${semEn.length} sem inglês`);
  if (detalhe || so.length) for (const x of semEn) console.log(`   ${x.linha}: ${x.texto.slice(0, 140)}`);
}
if (json) console.log(JSON.stringify(Object.fromEntries(emFalta), null, 1));
else console.log(`\n${lista.length} ficheiros do painel · ${falta} textos sem inglês (${emFalta.size} diferentes)`);
process.exitCode = falta ? 1 : 0;
