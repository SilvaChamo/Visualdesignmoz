'use client';

// Ícone à esquerda, dentro de todos os campos do painel (Silva, 21/10/2026: "todos os campos para preencher devem ter
// ícone à esquerda, dentro do campo"; os campos onde se escreve um domínio levam o globo). Em vez de mexer em cada
// campo de cada página, marca-se aqui o campo com data-ic="<ícone>" e o desenho vem do CSS (icones-campos.css, gerado
// dos SVG do Font Awesome). Só se acrescenta um atributo: nunca se muda a estrutura que o React desenha.
// Para forçar um ícone num campo: data-ic="globe" (ou outro nome do CSS). Para um campo sem ícone: data-ic-sem.
import { useEffect } from 'react';

const CAMPOS = 'input, select, textarea';
const SEM_ICONE_TIPOS = new Set(['checkbox', 'radio', 'hidden', 'file', 'range', 'color', 'submit', 'button', 'reset', 'image']);
/** abaixo desta largura (px) o campo fica sem ícone */
const LARGURA_MINIMA = 110;
/** zonas com desenho próprio (entrada e código de 2 passos do painel, seletor de domínio, separadores em caixa de escolha, terminal) */
const ZONAS_PROPRIAS = '[data-ic-sem], .ent, .da-domain-selector, .ptabs-sel, .term-cmd, .vh-nova-encomenda';

/** O texto da etiqueta do campo (sem o que está dentro de select/textarea, para não entrarem as opções) */
function etiqueta(el: HTMLElement): string {
  const caixa = el.closest('.frm-row')?.querySelector('.frm-lb') ?? el.closest('label') ?? el.closest('.da-campo, .field, .f, .passo, .campo')?.querySelector('label, .lbl');
  if (!caixa) return '';
  const copia = caixa.cloneNode(true) as HTMLElement;
  copia.querySelectorAll('select, textarea, input, option, small').forEach((n) => n.remove());
  return copia.textContent || '';
}

/** Escolhe o ícone: tipo do campo, depois o que diz a etiqueta, o texto de exemplo e o nome */
function escolher(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const tipo = (el.getAttribute('type') || 'text').toLowerCase();
  const exemplo = (el.getAttribute('placeholder') || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('name') || '') + ' ' + el.id;
  const txt = (etiqueta(el) + ' ' + exemplo).toLowerCase();

  if (tipo === 'password') return 'lock';
  // documentos de identificação (NUIT, NIF, BI…): o cartão
  if (/\bnuit\b|\bnif\b|contribuinte|\bbi\b|passaporte|identifica[cç][aã]o fiscal/.test(txt)) return 'cartao';
  // correio: vários ícones conforme o que o campo é
  if (/reencaminh|encaminh|destinat|\bsmtp\b/.test(txt)) return 'envio';
  if (/caixa de (correio|entrada)|mailbox|inbox/.test(txt)) return 'caixa';
  if (tipo === 'email' || /e-?mail|correio|\S@\S/.test(txt)) {
    if (/assunto|mensagem|resposta|f[eé]rias/.test(txt)) return 'cartaaberta';
    // endereços escritos como nome@dominio: a arroba; o resto: o envelope
    if (tipo !== 'email' && /\S@\S/.test(txt)) return 'arroba';
    return 'mail';
  }
  if (tipo === 'tel' || /telefone|telem[oó]vel|\bphone\b|whatsapp/.test(txt)) return 'phone';
  if (tipo === 'search' || /pesquis|procur|filtr|busca|search/.test(txt)) return 'search';
  if (tipo === 'date' || tipo === 'datetime-local' || /\bdata\b|\bdatas\b|\bdias?\b/.test(txt)) return 'calendar';
  if (tipo === 'time' || /\bhora\b|\bhoras\b|minuto|segundo|\bttl\b/.test(txt)) return 'clock';
  // domínios (nomes de domínio, subdomínios, servidores de nomes, endereços de exemplo.com…): o globo
  if (/dom[ií]nio|domain|subdom|nameserver|servidor de nomes|\bns\s?[1-4]\b|exemplo\.(com|co\.mz)|\.co\.mz|\.com\b|\.org\b|\.net\b|\balias\b/.test(txt)) return 'globe';
  if (/\bip\b|\bporta?\b|\bport\b|servidor|server|\bhost|\bmx\b|\bcname\b|registo|\bdns\b|@ =/.test(txt)) return 'server';
  if (/https?:|\burl\b|\blink\b|endere[cç]o do site|ligação|redirec/.test(txt)) return 'link';
  if (/pasta|direct[oó]rio|caminho|\bpath\b|wp-content|public_html|\//.test(txt)) return 'folder';
  if (/ssh|chave|\bkey\b|token|c[oó]digo|certificado|segredo|----/.test(txt)) return 'key';
  if (/base de dados|\bbd\b|\bsql\b|database/.test(txt)) return 'base';
  if (/utilizador|username|\blogin\b|\bconta\b|titular|cliente|propriet|\bnome\b|\bnomes\b|apelido|pessoa|contacto/.test(txt)) return 'user';
  if (/#[0-9a-f]{3,6}|\bcor\b|\bcores\b/.test(txt)) return 'cor';
  if (/logotipo|logótipo|\bimagem\b|\bfoto\b|ícone|icone/.test(txt)) return 'imagem';
  if (/comando|terminal|\bshell\b|\bcron\b/.test(txt)) return 'terminal';
  if (/\bphp\b|\bscript\b|c[oó]digo-fonte|\bhtml\b|\bcss\b|handler/.test(txt)) return 'codigo';
  if (/empresa|organiza|negócio/.test(txt)) return 'empresa';
  if (/morada|localiza|cidade|pa[ií]s/.test(txt)) return 'mapa';
  if (/t[ií]tulo|assunto|etiqueta|identifica|prefixo|descri[cç][aã]o curta/.test(txt)) return 'tag';
  if (/\bn[úu]mero|\bnum\b|limite|quantidade|tamanho|\bmax|\bmin|prio|\bgb\b|\bmb\b|\bmeg|\bcota|\bquota|^\s*\d|0 =/.test(txt) || tipo === 'number') return 'hash';
  if (tag === 'textarea' || /mensagem|texto|nota|coment|conte[úu]do|resposta/.test(txt)) return 'texto';
  if (tag === 'select') return 'lista';
  return 'caneta';
}

/** O campo já tem ícone desenhado por outro sítio (grupo .igrp com .ib, caixa de pesquisa com a sua lupa…) */
function jaTemIcone(el: HTMLElement): boolean {
  const pai = el.parentElement;
  if (!pai) return false;
  // grupo com o seu ícone decorativo à frente (caixa .ib que não é botão): o campo já o tem
  if (pai.classList.contains('igrp')) {
    const primeiro = pai.firstElementChild;
    if (primeiro && primeiro !== el && (primeiro.matches('span.ib, i, svg'))) return true;
    // os botões do grupo (gerar/mostrar palavra-passe) não são ícone do campo; o cadeado vai dentro do campo.
    // limite (valor + unidade): o ícone só vai no primeiro campo
    return pai.querySelector(CAMPOS) !== el;
  }
  // pesquisas e campos com o seu ícone ao lado
  return !!pai.querySelector(':scope > i, :scope > svg, :scope > .ib, :scope > .search-ic');
}

function acertar() {
  document.querySelectorAll<HTMLElement>(`.vh :is(${CAMPOS}):not([data-ic]):not([data-ic-feito])`).forEach((el) => {
    // escondido (separador ou janela fechada): fica para a próxima vez, quando já se vir
    if (el.offsetParent === null) return;
    el.setAttribute('data-ic-feito', '');
    const tipo = (el.getAttribute('type') || 'text').toLowerCase();
    if (el.tagName === 'INPUT' && SEM_ICONE_TIPOS.has(tipo)) return;
    if (el.hasAttribute('multiple') || (el.tagName === 'SELECT' && Number(el.getAttribute('size')) > 1)) return;
    if (el.closest(ZONAS_PROPRIAS) || jaTemIcone(el)) return;
    // campos pequenos (prioridade do DNS, números curtos, cores): o recuo do ícone não deixa espaço ao que se escreve
    if (el.offsetWidth < LARGURA_MINIMA) return;
    el.setAttribute('data-ic', escolher(el));
  });
}

/** Liga a marcação ao painel: corre quando o conteúdo muda (páginas, janelas, linhas novas) */
export function useIconesCampos() {
  useEffect(() => {
    let pedido = 0;
    const agendar = () => {
      if (pedido) return;
      pedido = requestAnimationFrame(() => {
        pedido = 0;
        acertar();
      });
    };
    agendar();
    // só filhos e texto (não atributos): o data-ic que se põe aqui não volta a disparar a marcação
    const obs = new MutationObserver(agendar);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      cancelAnimationFrame(pedido);
    };
  }, []);
}
