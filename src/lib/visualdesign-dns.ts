/**
 * Nameservers predefinidos Visual Design (painel / DNS / email).
 *
 * ns1, ns2, ns3 e ns4.visualdesignmoz.com apontam todos para o servidor Contabo (Hestia) e servem as mesmas zonas
 * (confirmado em 26/10/2026): qualquer um deles é nosso. O par que se dá aos clientes vem de NEXT_PUBLIC_VD_NAMESERVERS
 * no deploy (deploy-visualdesign.yml) e, sem isso, são ns1/ns2.
 */
export const VISUALDESIGN_TODOS_NS = [
  'ns1.visualdesignmoz.com',
  'ns2.visualdesignmoz.com',
  'ns3.visualdesignmoz.com',
  'ns4.visualdesignmoz.com',
];

const configured = (process.env.NEXT_PUBLIC_VD_NAMESERVERS || '')
  .split(',')
  .map((ns) => ns.trim().toLowerCase())
  .filter(Boolean);

export const VISUALDESIGN_DEFAULT_NS = {
  ns1: configured[0] || VISUALDESIGN_TODOS_NS[0],
  ns2: configured[1] || VISUALDESIGN_TODOS_NS[1],
};

export const VISUALDESIGN_NAMESERVERS = [VISUALDESIGN_DEFAULT_NS.ns1, VISUALDESIGN_DEFAULT_NS.ns2];

/** true se o nameserver é um dos nossos (ns1 a ns4, ou o par definido em NEXT_PUBLIC_VD_NAMESERVERS), com ou sem ponto final e em qualquer caixa */
export const ehNsNosso = (ns: string) => {
  const n = ns.toLowerCase().replace(/\.$/, '');
  return VISUALDESIGN_TODOS_NS.includes(n) || VISUALDESIGN_NAMESERVERS.includes(n);
};
