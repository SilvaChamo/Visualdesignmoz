#!/bin/bash
# Gera URL one-time DirectAdmin (só root). Chamado via sudo a partir do PHP.
set -euo pipefail
user="${1:-}"
if ! [[ "$user" =~ ^[a-z0-9._-]{1,64}$ ]]; then
  exit 1
fi
/usr/local/directadmin/directadmin login-url --user="$user" 2>/dev/null | tail -1
