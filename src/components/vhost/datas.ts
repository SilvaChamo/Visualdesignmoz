// Datas do painel (Silva, 27/10/2026: «a data do painel foi definida para ser apresentada em dia, mês e ano: nos backups e outros lugares»;
// «adiciona muitas outras formas de datas na escolha de datas»). Segue a preferência «Formato da data» (Preferências › Idioma e data, chave
// `vh-data`; por omissão `dmy`). Os dados do servidor chegam em ISO ("2026-10-27", "2026-10-27 22:29:54", "2026-10-27T22:29:54Z"): aqui só
// se muda a forma de mostrar, nunca o dado (a ordenação das tabelas continua a usar o texto original).

import { useSyncExternalStore } from 'react';

type Partes = { a: string; me: string; d: string; h: string; mi: string; dow: number };
type Formato = {
  id: string;
  dia: (p: Partes, en: boolean) => string;
  /** 24: 22:29 · 12: 10:29 PM · h: 22h29 · 0: sem hora */
  hora: '24' | '12' | 'h' | '0';
  /** entre a data e a hora */
  sep: string;
};

const MES_CURTO = {
  pt: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const MES_LONGO = {
  pt: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const SEMANA = {
  pt: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};
const lg = (en: boolean) => (en ? 'en' : 'pt');
const dnum = (p: Partes) => String(Number(p.d));

/** As formas de mostrar a data (a primeira é a de origem). O nome de cada uma, na escolha, é o exemplo de 31/12/2026 14:30. */
export const FORMATOS_DATA: Formato[] = [
  { id: 'dmy', dia: (p) => `${p.d}/${p.me}/${p.a}`, hora: '24', sep: ', ' },
  { id: 'dmy-traco', dia: (p) => `${p.d}-${p.me}-${p.a}`, hora: '24', sep: ' ' },
  { id: 'dmy-ponto', dia: (p) => `${p.d}.${p.me}.${p.a}`, hora: '24', sep: ' ' },
  { id: 'dmy-ano2', dia: (p) => `${p.d}/${p.me}/${p.a.slice(2)}`, hora: '24', sep: ', ' },
  { id: 'dmy-h', dia: (p) => `${p.d}/${p.me}/${p.a}`, hora: 'h', sep: ' ' },
  { id: 'dmy-12h', dia: (p) => `${p.d}/${p.me}/${p.a}`, hora: '12', sep: ', ' },
  { id: 'dmy-sem-hora', dia: (p) => `${p.d}/${p.me}/${p.a}`, hora: '0', sep: '' },
  { id: 'curto', dia: (p, en) => `${dnum(p)} ${MES_CURTO[lg(en)][Number(p.me) - 1]} ${p.a}`, hora: '24', sep: ', ' },
  { id: 'curto-12h', dia: (p, en) => `${dnum(p)} ${MES_CURTO[lg(en)][Number(p.me) - 1]} ${p.a}`, hora: '12', sep: ', ' },
  { id: 'semana', dia: (p, en) => `${SEMANA[lg(en)][p.dow]}, ${dnum(p)} ${MES_CURTO[lg(en)][Number(p.me) - 1]} ${p.a}`, hora: '24', sep: ', ' },
  { id: 'longo', dia: (p, en) => (en ? `${dnum(p)} ${MES_LONGO.en[Number(p.me) - 1]} ${p.a}` : `${dnum(p)} de ${MES_LONGO.pt[Number(p.me) - 1]} de ${p.a}`), hora: '24', sep: ', ' },
  { id: 'mdy', dia: (p) => `${p.me}/${p.d}/${p.a}`, hora: '12', sep: ', ' },
  { id: 'ymd', dia: (p) => `${p.a}-${p.me}-${p.d}`, hora: '24', sep: ' ' },
  { id: 'ymd-barra', dia: (p) => `${p.a}/${p.me}/${p.d}`, hora: '24', sep: ' ' },
  { id: 'iso', dia: (p) => `${p.a}-${p.me}-${p.d}`, hora: '24', sep: 'T' },
];

const lerPrefData = () => {
  try {
    const v = localStorage.getItem('vh-data') || 'dmy';
    return FORMATOS_DATA.find((f) => f.id === v) || FORMATOS_DATA[0];
  } catch {
    return FORMATOS_DATA[0];
  }
};
const emIngles = () => {
  try {
    return localStorage.getItem('vd-lang') === 'en';
  } catch {
    return false;
  }
};

const horaTexto = (f: Formato, h: string, mi: string) => {
  if (f.hora === 'h') return `${h}h${mi}`;
  if (f.hora === '12') {
    const n = Number(h);
    return `${n % 12 || 12}:${mi} ${n < 12 ? 'AM' : 'PM'}`;
  }
  return `${h}:${mi}`;
};

function formatar(f: Formato, p: Partes, comHora: boolean): string {
  const dia = f.dia(p, emIngles());
  return comHora && f.hora !== '0' ? `${dia}${f.sep}${horaTexto(f, p.h, p.mi)}` : dia;
}

const partesDe = (a: string, me: string, d: string, h = '00', mi = '00'): Partes => ({
  a,
  me,
  d,
  h,
  mi,
  dow: new Date(Date.UTC(Number(a), Number(me) - 1, Number(d))).getUTCDay(),
});

/** "2026-10-27" → "27/10/2026"; "2026-10-27 22:29[:54]" ou ISO com T → "27/10/2026, 22:29" (ou a forma escolhida). O que não for data fica como está. */
export function dataPt(s?: string | null): string {
  const v = (s ?? '').trim();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return v;
  const [, a, me, d, h, mi] = m;
  return formatar(lerPrefData(), partesDe(a, me, d, h, mi), !!h);
}

/** Uma data já em objeto (hora local) */
export function dataDe(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return formatar(lerPrefData(), partesDe(String(d.getFullYear()), p(d.getMonth() + 1), p(d.getDate()), p(d.getHours()), p(d.getMinutes())), true);
}

/** "vdadmin.2026-10-27_22-29-54.tar" → "vdadmin 27/10/2026:22.29.tar" (só o que se vê; a cópia continua a chamar-se como no servidor) */
export function nomeCopia(nome: string): string {
  const m = nome.match(/^(.+?)\.(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})(?:-\d{2})?(\.tar(?:\.gz|\.zst)?)$/);
  if (!m) return nome;
  const [, conta, a, me, d, h, mi, ext] = m;
  const f = lerPrefData();
  const p = partesDe(a, me, d, h, mi);
  // as duas formas de origem levam a hora como no pedido do Silva («vdadmin 27/10/2026:22.30.tar»); as outras, a sua própria hora
  // o nome de uma cópia leva sempre a hora (duas cópias do mesmo dia não podem parecer iguais), mesmo na forma «sem hora»
  const quando = f.id === 'dmy' || f.id === 'ymd' ? `${f.dia(p, emIngles())}:${h}.${mi}` : formatar(f.hora === '0' ? { ...f, hora: '24', sep: ' ' } : f, p, true);
  return `${conta} ${quando}${ext}`;
}

/** O nome de cada forma, na escolha: o exemplo de 31/12/2026 14:30 */
export const exemploData = (f: Formato) => formatar(f, partesDe('2026', '12', '31', '14', '30'), true);

/** Só o dia (sem hora), da forma escolhida; para datas que são dias (expira em, criada em…) */
export function dataSo(d: Date | string | number | null | undefined): string {
  if (d === null || d === undefined || d === '') return '—';
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return typeof d === 'string' ? d : '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return formatar(lerPrefData(), partesDe(String(x.getFullYear()), p(x.getMonth() + 1), p(x.getDate())), false);
}

const EVT = 'vh-data-mudou';
/** Guarda a forma escolhida e avisa as listas abertas para se desenharem de novo (sem recarregar a página) */
export function gravarFormatoData(id: string) {
  try {
    localStorage.setItem('vh-data', id);
  } catch {}
  window.dispatchEvent(new Event(EVT));
}
/** Faz o componente desenhar-se de novo quando a forma da data muda (as tabelas usam-no) */
export function useFormatoData(): string {
  return useSyncExternalStore(
    (f) => {
      window.addEventListener(EVT, f);
      return () => window.removeEventListener(EVT, f);
    },
    () => {
      try {
        return localStorage.getItem('vh-data') || 'dmy';
      } catch {
        return 'dmy';
      }
    },
    () => 'dmy',
  );
}
