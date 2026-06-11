#!/bin/bash
# Permissões FileGator (webapps) em contas DirectAdmin — upload, extract, edição.
set -euo pipefail

apply_user() {
  local user="$1"
  local home="/home/$user/domains"
  [ -d "$home" ] || return 0

  while IFS= read -r -d '' pub; do
    chattr -R -i "$pub" 2>/dev/null || true
    chown -R "$user:$user" "$pub" 2>/dev/null || true
    find "$pub" -type d -exec setfacl -m u:webapps:rwx {} + 2>/dev/null || true
    find "$pub" -type d -exec setfacl -d -m u:webapps:rwx {} + 2>/dev/null || true
    find "$pub" -type f -exec setfacl -m u:webapps:rw {} + 2>/dev/null || true
    echo "OK: $pub"
  done < <(find "$home" -mindepth 1 -maxdepth 1 -type d ! -name 'default' ! -name 'sharedip' ! -name 'suspended' -exec sh -c 'test -d "$1/public_html" && printf "%s\0" "$1/public_html"' _ {} \;)
}

if [ "${1:-}" = "--user" ] && [ -n "${2:-}" ]; then
  apply_user "$2"
else
  for u in /usr/local/directadmin/data/users/*/; do
    apply_user "$(basename "$u")"
  done
fi

echo "OK: permissões FileGator aplicadas"
