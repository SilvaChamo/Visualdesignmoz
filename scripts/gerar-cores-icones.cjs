// Gera src/components/vhost/paginas/icones-cores.css: cada ícone do painel (Font Awesome) com a sua cor, a mesma em todo o lado
// (Silva, 23/10/2026: "todos os ícones coloridos, incluindo os dos campos"). Paleta = a dos ícones do submenu (c1…c7).
// Uso: node scripts/gerar-cores-icones.cjs   — correr de novo quando se usa um ícone novo no painel.
// Os ícones dos campos (caixa cinzenta com data-ic) têm as cores em scripts/gerar-icones-campos.cjs (usa a tabela CORES_CAMPO daqui).
const fs = require('fs');
const path = require('path');

const FA = 'node_modules/@fortawesome/fontawesome-free/svgs/';
const existentes = new Set();
for (const d of ['solid', 'regular', 'brands']) for (const f of fs.readdirSync(FA + d)) existentes.add('fa-' + f.replace(/\.svg$/, ''));

// ---- cores: claro / escuro (as do submenu: c1 vermelho, c2 azul, c3 verde, c4 laranja, c5 roxo, c6 turquesa, c7 rosa)
const PALETA = {
  vermelho: ['#E5202E', '#F2555F'],
  azul: ['#2D7FF9', '#5B9BFF'],
  verde: ['#1C9D5B', '#34C27A'],
  laranja: ['#F08C00', '#FFA733'],
  roxo: ['#7B4DDB', '#A98BF0'],
  turquesa: ['#00A3B4', '#2CC4D4'],
  rosa: ['#E64A8B', '#F26FA5'],
};
const ORDEM = Object.keys(PALETA);

// ---- o que cada ícone quer dizer → a cor (primeira regra que servir)
const SEMANTICA = [
  [/^fa-(circle-stop|stop|hand|right-from-bracket|sun|eye-slash)/, 'laranja'],
  [/^fa-(upload|cloud-arrow-up|file-arrow-up|arrow-up-from-bracket|eye$|house|desktop|display|people-arrows|route|tower-broadcast|snowflake|signal)/, 'azul'],
  [/^fa-id-badge/, 'rosa'],
  [/^fa-(moon|eye-dropper|circle-half-stroke)/, 'roxo'],
  [/^fa-(trash|ban|circle-xmark|skull|eraser|user-slash|user-xmark|power-off|plug-circle-xmark|virus)/, 'vermelho'],
  [/^fa-(triangle-exclamation|circle-exclamation|exclamation|bug|fire|bolt|hourglass|clock-rotate|bell)/, 'laranja'],
  [/^fa-(check|circle-check|square-check|thumbs-up|shield|user-shield|lock-open|circle-plus|plus|user-plus|download|play|rocket|leaf|seedling|handshake|cart|basket|bag|money|dollar|wallet|credit|receipt|sack)/, 'verde'],
  [/^fa-(database|server|hard-drive|memory|microchip|network|sitemap|ethernet|cloud|cubes|boxes|box|layer|code|terminal|file-code|laptop-code|puzzle|plug)/, 'roxo'],
  [/^fa-(globe|link|copy|floppy|circle-info|info|share|paper-plane|external|arrow-up-right|up-right|wordpress|php|github|git|cloudflare|wifi|earth|language|i-cursor|right-left|right-to-bracket|arrow-right-to-bracket)/, 'azul'],
  [/^fa-(magnifying|clock|calendar|stopwatch|chart|gauge|list|table|folder|file|box-archive|clock-rotate|history|rotate|arrows-rotate|rotate-left|rotate-right)/, 'turquesa'],
  [/^fa-(envelope|at|inbox|comment|message|address|id-card|key|palette|heart|star|user|users|person|pen|pencil|i-cursor|signature|tag|tags|bookmark|gift|image|photo)/, 'rosa'],
  [/^fa-(lock|gear|gears|screwdriver|wrench|sliders|toolbox|hammer|shield-halved|key)/, 'laranja'],
];
// ícones de estrutura (setas, fechar, a rodar…) ficam como estão: sem cor própria
const NEUTROS = /^fa-(chevron|caret|angle|angles|arrow-(left|right|up|down)$|arrows-up-down|arrow-left|arrow-right|arrow-up$|arrow-down$|ellipsis|bars|sort|xmark$|spinner|circle-notch|grip|minus$|equals|up-down|left-right|circle$|square$|dot|genderless)/;
// tamanhos, rotações e famílias — não são ícones
const NAO_ICONE = /^fa-(solid|regular|brands|fw|spin|pulse|beat|flip|flip-horizontal|flip-vertical|rotate-90|rotate-180|rotate-270|xs|sm|lg|xl|2x|3x|4x|5x|2xs|1x|stack|inverse|border|pull|li|ul|sharp|duotone|light|thin|bounce|fade|shake|beat-fade|spin-pulse|spin-reverse)$/;

function corDe(nome) {
  for (const [re, c] of SEMANTICA) if (re.test(nome)) return c;
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ORDEM[h % ORDEM.length];
}

// ---- os ícones que o painel usa
function ficheiros(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? ficheiros(path.join(dir, e.name)) : /\.(tsx?|jsx?)$/.test(e.name) ? [path.join(dir, e.name)] : []));
}
const usados = new Set();
for (const f of [...ficheiros('src/components/vhost'), 'src/components/DomainSearchPainel.tsx', 'src/lib/menu-contas.ts'].filter((x) => fs.existsSync(x))) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/fa-[a-z0-9]+(?:-[a-z0-9]+)*/g)) if (!NAO_ICONE.test(m[0]) && existentes.has(m[0])) usados.add(m[0]);
}

const porCor = Object.fromEntries(ORDEM.map((c) => [c, []]));
const neutros = [];
for (const n of [...usados].sort()) {
  if (NEUTROS.test(n)) neutros.push(n);
  else porCor[corDe(n)].push(n);
}

// ---- onde o ícone leva a cor própria: o conteúdo (cartão principal, lado, janelas, gestor de ficheiros) — não a barra de cima, a barra
// de ícones nem o menu da esquerda, que já têm as suas cores — e nunca dentro do que já tem cor própria (botão vermelho, etiquetas…)
const AREAS = ['.da-main-card', '.da-lado', '.modal', '.fmda-corpo'];
const FORA = ['.trf-bola.para', '.fmda-icc', '.fmda-raiz', '.btn.r', '.btn-ed', '.btn-rm', '.btn.on', '.btn-save', '.tag', '.note', '.imp', '.chk', '.toast', '.perigo', '.dt-btn-direto', '.fmda-tb'];

let css = `/* Cor de cada ícone do painel (Silva, 23/10/2026: "todos os ícones coloridos"). GERADO por scripts/gerar-cores-icones.cjs — não editar à mão.
   Paleta do submenu (c1…c7), com versão mais clara no tema escuro. Cada ícone tem sempre a mesma cor. Ficam de fora os ícones de estrutura
   (setas, fechar, a rodar) e tudo o que já tem cor própria (botão vermelho, etiquetas, avisos, barra de cima, menu da esquerda). */
.vh {
${ORDEM.map((c) => `   --ci-${c}: ${PALETA[c][0]}`).join(';\n')}
}

.vh[data-theme=dark] {
${ORDEM.map((c) => `   --ci-${c}: ${PALETA[c][1]}`).join(';\n')}
}
`;
const excl = FORA.map((f) => `:not(${f} *):not(${f})`).join('');
for (const c of ORDEM) {
  if (!porCor[c].length) continue;
  const sel = AREAS.map((a) => `.vh ${a} :is(${porCor[c].map((n) => 'i.' + n).join(', ')})${excl}`).join(',\n');
  css += `\n/* ${c}: ${porCor[c].length} ícones */\n${sel} {\n   color: var(--ci-${c}) !important\n}\n`;
}
fs.writeFileSync('src/components/vhost/paginas/icones-cores.css', css);
console.log('icones-cores.css', css.length, 'bytes;', usados.size, 'ícones,', neutros.length, 'neutros');
for (const c of ORDEM) console.log(' ', c, porCor[c].length);

// ---- tabela para o gerador dos ícones dos campos (scripts/gerar-icones-campos.cjs)
const campos = {
  globe: 'azul', user: 'roxo', mail: 'rosa', lock: 'laranja', folder: 'laranja', search: 'turquesa', link: 'azul', phone: 'verde', hash: 'roxo',
  calendar: 'vermelho', clock: 'turquesa', server: 'roxo', key: 'rosa', texto: 'azul', tag: 'laranja', lista: 'turquesa', ficheiro: 'azul', base: 'verde',
  escudo: 'verde', cor: 'rosa', imagem: 'verde', terminal: 'roxo', codigo: 'roxo', caneta: 'laranja', mapa: 'vermelho', empresa: 'azul', cartao: 'turquesa',
  arroba: 'rosa', envio: 'azul', caixa: 'turquesa', cartaaberta: 'rosa',
};
fs.writeFileSync('scripts/cores-campos.json', JSON.stringify({ paleta: PALETA, campos }, null, 2) + '\n');
console.log('cores-campos.json escrito');
