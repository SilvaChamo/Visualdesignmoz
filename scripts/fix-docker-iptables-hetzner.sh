#!/bin/bash
# Restaura NAT/FORWARD para containers Docker acederem à internet (Google OAuth, SMTP, etc.)
# DirectAdmin/Exim por vezes limpa as regras Docker. Correr após reboot ou se OAuth der 504.
set -euo pipefail

MAIN_IF="${MAIN_IF:-eth0}"
SUPABASE_BRIDGE="${SUPABASE_BRIDGE:-br-afd2aa91627b}"
SUPABASE_SUBNET="${SUPABASE_SUBNET:-172.18.0.0/16}"
DOCKER_SUBNET="${DOCKER_SUBNET:-172.17.0.0/16}"

add_nat() {
  local subnet="$1" iface="$2"
  iptables -t nat -C POSTROUTING -s "$subnet" -o "$iface" -j MASQUERADE 2>/dev/null && return 0
  iptables -t nat -A POSTROUTING -s "$subnet" -o "$iface" -j MASQUERADE
}

add_forward() {
  local bridge="$1" iface="$2"
  iptables -C FORWARD -i "$bridge" -o "$iface" -j ACCEPT 2>/dev/null || \
    iptables -I FORWARD 1 -i "$bridge" -o "$iface" -j ACCEPT
  iptables -C FORWARD -i "$iface" -o "$bridge" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || \
    iptables -I FORWARD 1 -i "$iface" -o "$bridge" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
}

add_nat "$SUPABASE_SUBNET" "$MAIN_IF"
add_forward "$SUPABASE_BRIDGE" "$MAIN_IF"
add_nat "$DOCKER_SUBNET" "$MAIN_IF"
add_forward docker0 "$MAIN_IF"

echo "✅ Regras Docker NAT/FORWARD aplicadas ($SUPABASE_SUBNET, $DOCKER_SUBNET → $MAIN_IF)"
