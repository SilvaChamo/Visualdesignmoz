#!/bin/bash
# O DirectAdmin repõe o certificado do domínio pai sempre que corre
# `custombuild rewrite_confs` (ex.: depois de registar/alterar um
# subdomínio). Este script força de volta o certificado correto do
# subdomínio no httpd.conf. Correr no Hetzner como root, depois de
# qualquer rewrite_confs.
#
# Uso: SUB=site DOMAIN=visualdesignmoz.com USER=admin bash deploy/fix-directadmin-ssl-cert.sh

set -euo pipefail

SUB="${SUB:?defina SUB, ex.: SUB=site}"
DOMAIN="${DOMAIN:-visualdesignmoz.com}"
USER="${USER:-admin}"
HTTPD="/usr/local/directadmin/data/users/${USER}/httpd.conf"

python3 - "$HTTPD" "$SUB" "$DOMAIN" "$USER" <<'PY'
import sys
from pathlib import Path
httpd, sub, domain, user = sys.argv[1:5]
p = Path(httpd)
text = p.read_text()
cert = f"/usr/local/directadmin/data/users/{user}/domains/{sub}.{domain}.cert.combined"
key = f"/usr/local/directadmin/data/users/{user}/domains/{sub}.{domain}.key"
parent_cert = f"/usr/local/directadmin/data/users/{user}/domains/{domain}.cert.combined"
parent_key = f"/usr/local/directadmin/data/users/{user}/domains/{domain}.key"
blocks = text.split("<VirtualHost")
out = []
changed = 0
for block in blocks:
    if f"{sub}.{domain}" in block and ":443" in block.split(">")[0]:
        new_block = block.replace(f"SSLCertificateFile {parent_cert}", f"SSLCertificateFile {cert}")
        new_block = new_block.replace(f"SSLCertificateKeyFile {parent_key}", f"SSLCertificateKeyFile {key}")
        if new_block != block:
            changed += 1
        block = new_block
    out.append(block)
p.write_text("<VirtualHost".join(out))
print(f"Blocos corrigidos: {changed}")
PY

systemctl reload httpd
echo "OK: certificado de ${SUB}.${DOMAIN} forçado no httpd.conf"
