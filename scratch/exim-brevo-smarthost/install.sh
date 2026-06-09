#!/usr/bin/env bash
# Exim → Brevo smarthost (substitui porta 25 outbound na Hetzner)
# Uso no servidor: bash install.sh
set -euo pipefail

install -m 644 exim.routers.pre.conf /etc/exim.routers.pre.conf
install -m 644 exim.transports.pre.conf /etc/exim.transports.pre.conf
install -m 644 exim.authenticators.post.conf /etc/exim.authenticators.post.conf

if [[ ! -f /etc/exim.brevo.user || ! -f /etc/exim.brevo.pass ]]; then
  echo "Crie /etc/exim.brevo.user e /etc/exim.brevo.pass (credenciais Brevo SMTP)"
  exit 1
fi

chown root:mail /etc/exim.brevo.user /etc/exim.brevo.pass
chmod 640 /etc/exim.brevo.user /etc/exim.brevo.pass

exim -bV -C /etc/exim.conf >/dev/null
systemctl restart exim
exim -qf
echo "OK: Exim relay Brevo activo"
