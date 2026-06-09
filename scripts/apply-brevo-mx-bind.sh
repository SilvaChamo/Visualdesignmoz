#!/usr/bin/env bash
# Aplica MX Brevo (inbound) + SPF em zona BIND — um domínio ou todos
# Uso: apply-brevo-mx-bind.sh [dominio.com]
set -euo pipefail

SERVER_IP="${SERVER_IP:-37.27.17.25}"
ZONE_DIR="${ZONE_DIR:-/etc/bind}"
SPF="v=spf1 include:spf.brevo.com ip4:${SERVER_IP} ~all"

apply_zone() {
  local domain="$1"
  local zone="${ZONE_DIR}/${domain}.db"
  [[ -f "$zone" ]] || { echo "SKIP: sem zona $zone"; return 0; }

  cp "$zone" "${zone}.bak.$(date +%Y%m%d%H%M%S)"

  python3 - "$domain" "$zone" "$SPF" <<'PY'
import re, sys
domain, path, spf = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path).read()
text = re.sub(r'(\d{10})(\s+;\s+serial)', lambda m: f"{int(m.group(1))+1}{m.group(2)}", text, count=1)
lines = []
for line in text.splitlines():
    if '\tIN\tMX\t' in line and domain in line:
        continue
    if domain in line and '\tIN\tTXT\t' in line and 'v=spf1' in line:
        lines.append(f'{domain}.\t3600\tIN\tTXT\t"{spf}"')
        continue
    lines.append(line)
mx1 = f'{domain}.\t3600\tIN\tMX\t10 inbound1.sendinblue.com.'
mx2 = f'{domain}.\t3600\tIN\tMX\t20 inbound2.sendinblue.com.'
out, inserted = [], False
for line in lines:
    out.append(line)
    if not inserted and '\tIN\tA\t' in line and f'{domain}.' in line:
        out.append(mx1)
        out.append(mx2)
        inserted = True
if not inserted:
    out.extend([mx1, mx2])
open(path, 'w').write('\n'.join(out) + '\n')
print(f'OK: {domain}')
PY

  named-checkzone "$domain" "$zone" >/dev/null
  rndc reload "$domain" 2>/dev/null || systemctl reload named
}

if [[ -n "${1:-}" ]]; then
  apply_zone "$1"
else
  for z in "${ZONE_DIR}"/*.db; do
    d=$(basename "$z" .db)
    apply_zone "$d" || true
  done
fi

echo "DNS Brevo MX aplicado."
