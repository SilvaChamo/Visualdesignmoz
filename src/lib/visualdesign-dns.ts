/**
 * Nameservers Visual Design — cada par serve os sites do seu servidor:
 * ns1/ns2 → Hetzner (DirectAdmin, 37.27.17.25)
 * ns3/ns4 → Contabo (Hestia, 169.58.148.144)
 */
export const HETZNER_NS = {
  ns1: 'ns1.visualdesignmoz.com',
  ns2: 'ns2.visualdesignmoz.com',
} as const;

export const CONTABO_NS = {
  ns1: 'ns3.visualdesignmoz.com',
  ns2: 'ns4.visualdesignmoz.com',
} as const;

/** Predefinição (contas DirectAdmin/Hetzner e contas antigas sem provider). */
export const VISUALDESIGN_DEFAULT_NS = HETZNER_NS;

/** Par de nameservers do servidor onde a conta está ('hestia' = Contabo). */
export function nameserversForProvider(provider?: string | null): { ns1: string; ns2: string } {
  return provider === 'hestia' ? CONTABO_NS : HETZNER_NS;
}

export const VISUALDESIGN_NAMESERVERS = [
  HETZNER_NS.ns1,
  HETZNER_NS.ns2,
  CONTABO_NS.ns1,
  CONTABO_NS.ns2,
] as const;
