/**
 * Nameservers predefinidos Visual Design (painel / DNS / email).
 *
 * Cada servidor tem o seu par e um domínio usa só o par do servidor onde está
 * alojado — misturar pares faz a internet responder ora com um servidor ora
 * com o outro. Hetzner: ns1/ns2 (por omissão). Contabo: ns3/ns4, vindos de
 * NEXT_PUBLIC_VD_NAMESERVERS no deploy (deploy-contabo.yml).
 */
const configured = (process.env.NEXT_PUBLIC_VD_NAMESERVERS || '')
  .split(',')
  .map((ns) => ns.trim().toLowerCase())
  .filter(Boolean);

export const VISUALDESIGN_DEFAULT_NS = {
  ns1: configured[0] || 'ns1.visualdesignmoz.com',
  ns2: configured[1] || 'ns2.visualdesignmoz.com',
};

export const VISUALDESIGN_NAMESERVERS = [VISUALDESIGN_DEFAULT_NS.ns1, VISUALDESIGN_DEFAULT_NS.ns2];
