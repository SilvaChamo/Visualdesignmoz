#!/usr/bin/env node
// Verifica as traduções do site público (regra do Silva, 14/10/2026: todo o conteúdo do site tem versão inglesa).
//
//   node scripts/i18n-verificar.mjs          → resumo por ficheiro
//   node scripts/i18n-verificar.mjs -v       → também cada texto
//   node scripts/i18n-verificar.mjs ficheiro → só esse ficheiro (com os textos)
//
// Lista os textos em português das páginas públicas (JSX, placeholders/títulos e listas de dados) que ainda não têm
// versão inglesa em src/lib/i18n-textos.ts — esses ficam em português com o inglês escolhido (a tradução automática,
// src/components/layout/TraducaoAutomatica.tsx, só troca o que está no dicionário). Textos com `${…}` no meio não se
// traduzem sozinhos: separar a parte variável num elemento à parte. Com --json escreve a lista em falta (para copiar
// para o dicionário). Sai com código 1 quando falta alguma coisa.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(path.join(raiz, 'package.json'));
const ts = require('typescript');

// Partes do site que NÃO são o site público (painéis, área de cliente, API) — não entram na verificação.
const FORA = [
  /^src\/app\/(api|vhost|painel|webmail|dashboard|actions|cliente|guest|revendedor|profissional|contabilidade|recibo|pagamento|encomendas|renovacao|credito|checkout|dev-preview[^/]*)\//,
  /^src\/components\/(vhost|admin|dashboard|panel|client|guest|revendedor|encomendas|documents|ui)\//,
  /^src\/lib\/(?!(brand-landing-content|pricing-catalog|services-catalog|package-catalog|email-plans|hosting-plans|quotation-status-labels|auth-messages)\.ts$)/,
  /^src\/(contexts|hooks|types|utils|services)\//,
];
const fora = (rel) => FORA.some((r) => r.test(rel));

// Pontos de entrada: todas as páginas e layouts públicos.
function paginasPublicas() {
  const out = [];
  const andar = (d) => {
    for (const e of fs.readdirSync(path.join(raiz, d), { withFileTypes: true })) {
      const rel = path.posix.join(d, e.name);
      if (e.isDirectory()) andar(rel);
      else if (/^(page|layout|not-found)\.tsx$/.test(e.name) && !fora(rel)) out.push(rel);
    }
  };
  andar('src/app');
  return out;
}

function resolver(de, esp) {
  let base;
  if (esp.startsWith('@/')) base = path.join(raiz, 'src', esp.slice(2));
  else if (esp.startsWith('.')) base = path.resolve(path.dirname(path.join(raiz, de)), esp);
  else return null;
  for (const c of [base, base + '.tsx', base + '.ts', path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.relative(raiz, c).split(path.sep).join('/');
  }
  return null;
}

// Ficheiros alcançados a partir das páginas públicas (seguindo os imports locais).
function ficheirosPublicos() {
  const vistos = new Set();
  const fila = paginasPublicas();
  while (fila.length) {
    const f = fila.pop();
    if (vistos.has(f) || fora(f) || !/\.tsx?$/.test(f)) continue;
    vistos.add(f);
    const src = fs.readFileSync(path.join(raiz, f), 'utf8');
    for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const r = resolver(f, m[1] || m[2]);
      if (r) fila.push(r);
    }
  }
  return [...vistos].sort();
}

// Parece português (e não um nome, código, URL ou classe)?
const PALAVRAS_PT =
  /\b(de|da|do|das|dos|para|com|não|nós|nosso|nossa|nossos|nossas|seu|sua|seus|suas|em|uma|um|os|as|que|mais|são|está|ao|aos|na|no|nas|nos|pelo|pela|até|também|sem|ou|é|e|o|a|por|como|todos|todas|já|ver|saiba|pedir|enviar|contacte|serviços?|preços?|empresa|cliente|grátis|gratuito)\b|ção|ções|ões|ã|õ|ç|á|é|í|ó|ú|â|ê|ô/i;
function pareceTexto(s) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length < 2 || !/[a-zà-ú]{2}/i.test(t)) return false;
  if (/^(https?:|mailto:|tel:|\/|#|\.|@)/.test(t)) return false;
  if (/^[\w-]+(\s+[\w:/[\].%#()-]+)*$/.test(t) && /(^|\s)(flex|grid|text-|bg-|px-|py-|w-|h-|rounded|border|items-|justify-|gap-|font-|hidden|block|absolute|relative)/.test(t)) return false;
  if (/^[a-z][\w.-]*$/.test(t) && !/[à-ú]/i.test(t)) return false; // identificadores, chaves
  if (PALAVRAS_PT.test(t)) return true;
  // palavras soltas ("Hospedagem", "Marcas Parceiras"): texto com letras que não parece código, classe nem nome técnico
  if (/[{}<>=;$]|=>|\(\)/.test(t) || /^[A-Z0-9_]+$/.test(t) || /^[\w-]+\.(tsx?|jsx?|png|jpe?g|webp|svg|pdf)$/.test(t)) return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(t)) return false; // camelCase / identificadores
  if (/^[A-Z][a-z]+[A-Z]\w*$/.test(t) || /^[A-Z]{2,}-[\w-]+$/.test(t) || /^\d+-\w+$/.test(t)) return false; // PascalCase, códigos (VD-Email-…)
  if (/^(polygon|calc|rgba?|url)\(|^\(|\[[^\]]*\]|^[\w-]+:$/.test(t)) return false; // CSS, media queries, classes com [..]
  if (/^[0-9][\w]{15,}$/.test(t)) return false; // chaves
  if (/^[a-z0-9-]+(\s[a-z0-9:/[\].%#()-]+)+$/.test(t)) return false; // listas de classes
  return /[A-ZÀ-Úa-zà-ú]{3}/.test(t);
}

const ATRIBUTOS_TEXTO = new Set(['placeholder', 'title', 'alt', 'aria-label', 'label', 'description', 'subtitle', 'text']);
const ATRIBUTOS_FORA = new Set(['className', 'href', 'src', 'id', 'key', 'type', 'name', 'style', 'target', 'rel', 'role', 'as', 'variant', 'size', 'sizes', 'value', 'autoComplete', 'inputMode', 'pattern', 'method', 'action', 'htmlFor', 'fill', 'stroke', 'd', 'viewBox']);

function dentroDeT(no) {
  for (let p = no.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const n = p.expression.getText();
      if (n === 't' || n.endsWith('.t') || n === 'tr' || n === 'textoEn') return true;
      if (/^(console\.|cn$|clsx$|twMerge$|require$|fetch$|encodeURIComponent$|new URL$|redirect$|router\.|.*\.(push|replace|startsWith|endsWith|includes|split|join|test|match|get|set|eq|from|select|order|filter)$)/.test(n)) return 'ignorar';
    }
    if (ts.isJsxElement(p) && p.openingElement.tagName.getText() === 'T') return true;
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return 'ignorar';
    if (ts.isJsxAttribute(p)) {
      const n = p.name.getText();
      if (ATRIBUTOS_FORA.has(n) || n === 'dangerouslySetInnerHTML') return 'ignorar';
    }
    if (ts.isPropertyAssignment(p)) {
      const n = p.name.getText().replace(/['"]/g, '');
      if (/^(className|href|src|image|img|icon|slug|id|key|url|link|path|color|bg|type|cor|keywords|tags|__html)$/i.test(n)) return 'ignorar';
    }
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(p.operatorToken.kind)) return 'ignorar';
    if (ts.isCaseClause(p)) return 'ignorar';
    if (ts.isElementAccessExpression(p)) return 'ignorar';
    if (ts.isNewExpression(p) && /Error$/.test(p.expression.getText())) return 'ignorar';
    if (ts.isThrowStatement(p)) return 'ignorar';
    if (ts.isFunctionDeclaration(p) && /^(generateMetadata)$/.test(p.name?.getText() || '')) return 'ignorar';
    if (ts.isVariableDeclaration(p) && /^metadata$/.test(p.name.getText())) return 'ignorar';
  }
  return false;
}

const entidades = (s) =>
  s.replace(/&(quot|amp|apos|lt|gt|nbsp|#39);/g, (_, e) => ({ quot: '"', amp: '&', apos: "'", lt: '<', gt: '>', nbsp: ' ', '#39': "'" })[e]);

function analisar(rel) {
  const src = fs.readFileSync(path.join(raiz, rel), 'utf8');
  const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const textos = [];
  const visitar = (no) => {
    let texto = null;
    let variavel = false;
    if (ts.isJsxText(no)) texto = entidades(no.getText());
    else if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) {
      const p = no.parent;
      texto = ts.isJsxAttribute(p) && ATRIBUTOS_FORA.has(p.name.getText()) ? null : no.text;
    } else if (ts.isTemplateExpression(no)) {
      texto = no.head.text + no.templateSpans.map((s, i) => `{${i}}` + s.literal.text).join('');
      variavel = true;
    }
    if (texto != null && pareceTexto(texto) && !dentroDeT(no)) {
      textos.push({ texto: texto.replace(/\s+/g, ' ').trim(), variavel, linha: sf.getLineAndCharacterOfPosition(no.getStart()).line + 1 });
    }
    ts.forEachChild(no, visitar);
  };
  visitar(sf);
  return textos;
}

// O dicionário (chaves = texto em português)
const fonteTextos = fs.readFileSync(path.join(raiz, 'src/lib/i18n-textos.ts'), 'utf8');
const comIngles = new Set();
{
  const sf = ts.createSourceFile('x.ts', fonteTextos, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const v = (n) => {
    if (ts.isPropertyAssignment(n) && (ts.isStringLiteral(n.name) || ts.isNoSubstitutionTemplateLiteral(n.name))) comIngles.add(n.name.text.replace(/\s+/g, ' ').trim());
    if (ts.isArrayLiteralExpression(n)) for (const e of n.elements) if (ts.isStringLiteral(e)) comIngles.add(e.text.replace(/\s+/g, ' ').trim());
    ts.forEachChild(n, v);
  };
  v(sf);
}

const args = process.argv.slice(2);
const detalhe = args.includes('-v');
const json = args.includes('--json');
const so = args.filter((a) => !a.startsWith('-')).map((a) => path.relative(raiz, path.resolve(a)).split(path.sep).join('/'));
const lista = so.length ? so : ficheirosPublicos();

let falta = 0;
const emFalta = new Map();
for (const f of lista) {
  const semEn = analisar(f).filter((x) => !comIngles.has(x.texto));
  if (!semEn.length) continue;
  falta += semEn.length;
  for (const x of semEn) if (!emFalta.has(x.texto)) emFalta.set(x.texto, f + ':' + x.linha);
  if (json) continue;
  console.log(`${f}: ${semEn.length} sem inglês`);
  if (detalhe || so.length) for (const x of semEn) console.log(`   ${x.linha}: ${x.texto.slice(0, 120)}`);
}
if (json) console.log(JSON.stringify(Object.fromEntries(emFalta), null, 1));
else console.log(`\n${lista.length} ficheiros públicos · ${falta} textos sem inglês (${emFalta.size} diferentes)`);
process.exit(falta ? 1 : 0);
