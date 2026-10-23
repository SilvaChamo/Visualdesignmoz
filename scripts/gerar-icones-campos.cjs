// Gera src/components/vhost/paginas/icones-campos.css a partir dos SVG do Font Awesome (solid).
// Uso: node scripts/gerar-icones-campos.cjs   (a escolha do ícone de cada campo está em src/components/vhost/icones-campos.ts)
const fs = require('fs');
// cores por ícone (Silva, 23/10/2026: ícones coloridos): scripts/cores-campos.json, escrito por scripts/gerar-cores-icones.cjs
const cores = JSON.parse(fs.readFileSync('scripts/cores-campos.json', 'utf8'));
const dir = 'node_modules/@fortawesome/fontawesome-free/svgs/solid/';
const icones = { globe: 'globe', user: 'user', mail: 'envelope', lock: 'lock', folder: 'folder', search: 'magnifying-glass', link: 'link', phone: 'phone', hash: 'hashtag', calendar: 'calendar-days', clock: 'clock', server: 'server', key: 'key', texto: 'file-lines', tag: 'tag', lista: 'list', ficheiro: 'file', base: 'database', escudo: 'shield-halved', cor: 'palette', imagem: 'image', terminal: 'terminal', codigo: 'code', caneta: 'pen', mapa: 'location-dot', empresa: 'building', cartao: 'id-card', arroba: 'at', envio: 'paper-plane', caixa: 'inbox', cartaaberta: 'envelope-open-text' };
const uri = (f, cor) => {
  const svg = fs.readFileSync(dir + f + '.svg', 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace('<svg ', `<svg fill="${cor}" `).trim();
  return 'data:image/svg+xml,' + svg.replace(/"/g, "'").replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23').replace(/\s+/g, ' ');
};
const seta = (cor) => `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='${cor}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 6l5 5 5-5'/%3E%3C/svg%3E`;
let css = `/* Ícone de cada campo numa caixa cinzenta colada à esquerda, como nos campos das Definições PHP (Silva, 21/10/2026: "em todo o sítio onde
   puser ícone, assim como está na imagem"). A caixa é desenhada no próprio campo (fundo: ícone, caixa e linha), sem mexer na estrutura que
   o React desenha. O ícone vem de data-ic, posto por icones-campos.ts. GERADO por scripts/gerar-icones-campos.cjs (Font Awesome 6.5.2,
   solid) — não editar à mão. Cor do ícone: a de cada ícone (scripts/cores-campos.json), mais clara no tema escuro. */
`;
for (const [n, f] of Object.entries(icones)) css += `.vh [data-ic="${n}"] {\n   --ic: url("${uri(f, cores.paleta[cores.campos[n] || 'azul'][0])}")\n}\n\n`;
for (const [n, f] of Object.entries(icones)) css += `.vh[data-theme=dark] [data-ic="${n}"] {\n   --ic: url("${uri(f, cores.paleta[cores.campos[n] || 'azul'][1])}")\n}\n\n`;
css += `.vh {
   --seta-campo: url("${seta('%236E6E73')}")
}

.vh[data-theme=dark] {
   --seta-campo: url("${seta('%2394A3B8')}")
}

/* caixa de 36 px (como o .ib) + linha de 1 px a separar do campo; o texto começa 10 px depois */
.vh :is(input, select, textarea)[data-ic]:not(#x) {
   --ic-box: var(--soft);
   background-image: var(--ic), linear-gradient(var(--ic-box), var(--ic-box)), linear-gradient(var(--line), var(--line));
   background-repeat: no-repeat;
   background-position: 11px center, 0 0, 36px 0;
   background-size: 14px, 36px 100%, 1px 100%;
   padding-left: 48px !important
}

.vh textarea[data-ic]:not(#x) {
   background-position: 11px 13px, 0 0, 36px 0
}

/* escolha (select): a seta própria à direita (a regra geral dos selects tem de ser vencida, daí os :not iguais) */
.vh select[data-ic]:not(#x):not([multiple]):not([size]):not(.da-domain-selector select):not(.ptabs-sel select) {
   background-image: var(--ic), linear-gradient(var(--ic-box), var(--ic-box)), linear-gradient(var(--line), var(--line)), var(--seta-campo);
   background-position: 11px center, 0 0, 36px 0, right 14px center;
   background-size: 14px, 36px 100%, 1px 100%, 12px
}

/* campos que já são cinzento suave (motor de busca de Registar domínio): a caixa um pouco mais escura para se ver */
.vh .dom-busca-cartao [data-ic]:not(#x) {
   --ic-box: color-mix(in srgb, var(--soft), var(--ink) 8%)
}
`;
fs.writeFileSync('src/components/vhost/paginas/icones-campos.css', css);
console.log('icones-campos.css', css.length, 'bytes');
