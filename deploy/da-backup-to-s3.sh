#!/usr/bin/env bash
# DirectAdmin backups → Hetzner Object Storage (encriptado, balde separado).
# DA não suporta S3 nativo — grava em /home/admin/admin_backups; este script envia via rclone crypt.
#
# Destino: hetzner-da-crypt:admin_backups/ → visualdesign-backups/da-backups/ (encriptado)
# Leitura: só com credenciais S3 + senha crypt (/root/.config/da-backup-crypt.pass)
#
# Instalar: /root/da-backup-to-s3.sh
# Cron (domingo 04:30, após backups DA 00:30 e 02:30):
#   30 4 * * 0 /root/da-backup-to-s3.sh >> /var/log/da-backup-s3.log 2>&1
set -euo pipefail

REMOTE="${REMOTE:-hetzner-da-crypt:admin_backups}"
SOURCE_DIR="${SOURCE_DIR:-/home/admin/admin_backups}"
KEEP="${KEEP:-2}"
LOG_TAG="[da-backup-s3 $(date -Is)]"

log() { echo "${LOG_TAG} $*"; }
die() { log "ERRO: $*"; exit 1; }

command -v rclone >/dev/null 2>&1 || die "rclone não encontrado"
rclone listremotes | grep -q '^hetzner-da-crypt:$' || die "remote hetzner-da-crypt não configurado"
[[ -d "$SOURCE_DIR" ]] || die "pasta inexistente: $SOURCE_DIR"

mapfile -t FILES < <(
	find "$SOURCE_DIR" -maxdepth 1 -type f \( -name '*.tar.zst' -o -name '*.tar.gz' -o -name '*.tar' \) -printf '%T@ %p\n' 2>/dev/null \
		| sort -rn | cut -d' ' -f2-
)

if ((${#FILES[@]} == 0)); then
	log "Nenhum backup novo em $SOURCE_DIR"
	exit 0
fi

for file in "${FILES[@]}"; do
	[[ -f "$file" ]] || continue
	base="$(basename "$file")"
	dest="${REMOTE}/${base}"

	if rclone lsl "$dest" &>/dev/null; then
		log "Já no balde, saltar: $base"
		continue
	fi

	log "Upload encriptado: $file → $dest"
	rclone copyto "$file" "$dest" --s3-acl private

	local_size="$(stat -c '%s' "$file")"
	remote_bytes="$(rclone lsl "$dest" 2>/dev/null | awk '{print $1}' | head -1)"
	if [[ -z "$remote_bytes" ]]; then
		die "Verificação falhou: $base (remoto inexistente)"
	fi
	# Ficheiros encriptados: tamanho remoto ≠ local (só confirmar que existe e > 0)
	if [[ "$remote_bytes" -lt 1024 ]]; then
		die "Verificação falhou: $base (remoto suspeito: ${remote_bytes} bytes)"
	fi
	log "Verificado OK: $base (local=${local_size}, remoto_enc=${remote_bytes})"

	rm -f "$file"
	log "Removido local: $file"
done

# Retenção no balde: KEEP mais recentes por família (admin.root.admin*, reseller.admin.*, …)
mapfile -t REMOTE_LIST < <(rclone lsf "$REMOTE/" 2>/dev/null | grep -E '\.(tar\.zst|tar\.gz|tar)$' || true)

declare -A GROUP_FILES=()
for rf in "${REMOTE_LIST[@]}"; do
	prefix="${rf%%.tar*}"
	GROUP_FILES["$prefix"]+="${rf} "
done

for prefix in "${!GROUP_FILES[@]}"; do
	read -r -a group <<<"${GROUP_FILES[$prefix]}"
	if ((${#group[@]} <= KEEP)); then
		continue
	fi
	mapfile -t sorted < <(
		for g in "${group[@]}"; do
			ts="$(rclone lsl "${REMOTE}/${g}" 2>/dev/null | awk '{print $2, $3, $1, $4}')"
			echo "$ts"
		done | sort -r | awk '{print $4}'
	)
	for ((i = KEEP; i < ${#sorted[@]}; i++)); do
		old="${sorted[$i]}"
		[[ -n "$old" ]] || continue
		log "Retenção: apagar antigo no balde → $old"
		rclone delete "${REMOTE}/${old}" 2>/dev/null || true
	done
done

# Duplicado revenda em user_backups (DA também grava em admin_backups)
USER_DUP="/home/oshercollective/user_backups/oshercollective.tar.zst"
if [[ -f "$USER_DUP" ]] && rclone lsf "$REMOTE/" 2>/dev/null | grep -q 'reseller.admin.oshercollective'; then
	rm -f "$USER_DUP"
	log "Removido duplicado revenda: $USER_DUP"
fi

log "Concluído"
