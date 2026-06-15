#!/usr/bin/env bash
# Vigilância RAM — alerta DirectAdmin Mensagens (admin) se disponível < limiar.
# Uso: /root/aamihe-server-scripts/server-ram-watch.sh
set -euo pipefail

THRESHOLD_MB="${RAM_THRESHOLD_MB:-1024}"
COOLDOWN_SEC="${RAM_ALERT_COOLDOWN_SEC:-3600}"
STATE_DIR="${STATE_DIR:-/var/lib/aamihe-guardian}"
STATE_FILE="${STATE_DIR}/ram-alert.state"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=da-notify.sh
source "${SCRIPT_DIR}/da-notify.sh"

mkdir -p "$STATE_DIR"

avail_mb="$(free -m | awk '/^Mem:/ {print $7}')"
total_mb="$(free -m | awk '/^Mem:/ {print $2}')"
used_mb="$(free -m | awk '/^Mem:/ {print $3}')"
swap_used_mb="$(free -m | awk '/^Swap:/ {print $3}')"
load_avg="$(awk '{print $1", "$2", "$3}' /proc/loadavg)"
host_label="$(hostname -f 2>/dev/null || hostname)"

now_epoch="$(date +%s)"
last_alert=0
alerting=0
if [[ -f "$STATE_FILE" ]]; then
	# shellcheck source=/dev/null
	source "$STATE_FILE"
fi

if (( avail_mb < THRESHOLD_MB )); then
	if (( alerting == 1 )) && (( now_epoch - last_alert < COOLDOWN_SEC )); then
		exit 0
	fi
	body="Servidor: ${host_label}
RAM disponível: ${avail_mb} MB (limiar: ${THRESHOLD_MB} MB)
RAM total: ${total_mb} MB | usada: ${used_mb} MB
Swap em uso: ${swap_used_mb} MB
Carga (1/5/15 min): ${load_avg}

Acção sugerida: verificar contentores Docker, MySQL e PHP-FPM."

	send_da_admin_notify "[RAM] Memória baixa" "$body"
	echo "alerting=1" >"$STATE_FILE"
	echo "last_alert=${now_epoch}" >>"$STATE_FILE"
	exit 0
fi

if (( alerting == 1 )); then
	body="Servidor: ${host_label}
RAM disponível: ${avail_mb} MB (recuperado; limiar: ${THRESHOLD_MB} MB)
RAM total: ${total_mb} MB | usada: ${used_mb} MB
Swap em uso: ${swap_used_mb} MB"

	send_da_admin_notify "[RAM] Memória recuperada" "$body"
fi

echo "alerting=0" >"$STATE_FILE"
echo "last_alert=${last_alert}" >>"$STATE_FILE"
