#!/bin/bash
# Actualiza fullchain do proxy :2026 (leaf + cadeia ISRG Root X1, compatível com macOS).
set -euo pipefail
LE=/usr/local/directadmin/data/.lego/certificates/host.visualdesignmoz.com
OUT=/opt/da-cookie-proxy/fullchain.pem
if [[ ! -f "${LE}.crt" ]] || [[ ! -f "${LE}.issuer.crt" ]]; then
  exit 0
fi
{
  cat "${LE}.crt"
  # YR2 + Root YR assinado por ISRG Root X1 (não incluir root autoassinado)
  awk '/BEGIN CERTIFICATE/{n++} n>=1 && n<=2' "${LE}.issuer.crt"
} > "${OUT}.tmp"
mv "${OUT}.tmp" "${OUT}"
chmod 644 "${OUT}"
systemctl restart da-cookie-proxy 2>/dev/null || true
