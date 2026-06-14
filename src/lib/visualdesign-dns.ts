/** Nameservers predefinidos Visual Design (painel / DNS / email). */
export const VISUALDESIGN_DEFAULT_NS = {
  ns1: 'ns1.visualdesignmoz.com',
  ns2: 'ns2.visualdesignmoz.com',
} as const;

export const VISUALDESIGN_NAMESERVERS = [
  VISUALDESIGN_DEFAULT_NS.ns1,
  VISUALDESIGN_DEFAULT_NS.ns2,
  'ns3.visualdesignmoz.com',
  'ns4.visualdesignmoz.com',
] as const;
