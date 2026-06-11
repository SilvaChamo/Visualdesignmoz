#!/bin/bash
# Extracção tar como dono da conta (chamado pelo FileGator via sudo).
set -euo pipefail

owner="${1:?owner}"
archive="${2:?archive}"
dest="${3:?dest}"

[[ "$owner" =~ ^[a-zA-Z0-9_]+$ ]] || exit 2
[[ -f "$archive" ]] || exit 3
[[ -d "$dest" ]] || exit 4

real_archive="$(readlink -f "$archive")"
real_dest="$(readlink -f "$dest")"
real_home="$(readlink -f "/home/$owner")"

[[ "$real_archive" == "$real_home"/* ]] || exit 5
[[ "$real_dest" == "$real_home"/* ]] || exit 5

if [[ "$real_archive" =~ \.tar$ ]]; then
  tar -xf "$real_archive" -C "$real_dest"
else
  tar -xzf "$real_archive" -C "$real_dest"
fi

chown -R "$owner:$owner" "$real_dest"
find "$real_dest" -type d -exec setfacl -m u:webapps:rwx {} + 2>/dev/null || true
find "$real_dest" -type d -exec setfacl -d -m u:webapps:rwx {} + 2>/dev/null || true
find "$real_dest" -type f -exec setfacl -m u:webapps:rw {} + 2>/dev/null || true
