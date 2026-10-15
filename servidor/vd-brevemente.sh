#!/bin/bash
# VisualDesign — página "Brevemente" automática nos sites sem conteúdo (Silva, 15/10/2026).
# Um site só recebe a página quando TUDO isto se confirma:
#   1. não tem aplicação por trás (modelo de proxy do Hestia = "default": nada de nodejs, supabase, etc.);
#   2. a pasta public_html só tem a página de origem do Hestia, intacta (+ robots.txt / favicon.ico);
#   3. o próprio site, visto de dentro do servidor, mostra mesmo essa página de origem;
#   4. a conta e o domínio não estão na lista de exclusão (/etc/vd-brevemente-excluir: contas ou domínios, um por
#      linha — por defeito a oshercollective, cujos sites parecem vazios mas não estão).
# A página antiga fica guardada em /root/brevemente-copias/. Registo em /var/log/vd-brevemente.log.
# Uso: vd-brevemente.sh            -> aplica
#      vd-brevemente.sh --ver      -> só mostra o que faria
H=/usr/local/hestia/bin
ORIG=/root/hestia-skel-index-original.html
PAGINA=/usr/local/hestia/data/templates/web/skel/public_html/index.html
EXCLUIR=/etc/vd-brevemente-excluir
LOG=/var/log/vd-brevemente.log
VER=0; [ "$1" = "--ver" ] && VER=1
[ -f "$ORIG" ] && grep -q "<h1>Brevemente</h1>" "$PAGINA" || { echo "falta a página de origem ou a Brevemente"; exit 1; }
excluido() { [ -f "$EXCLUIR" ] && grep -qxF -e "$1" -e "$2" "$EXCLUIR"; }
for u in $($H/v-list-users plain | cut -f1); do
  for d in $($H/v-list-web-domains "$u" plain | cut -f1); do
    P=/home/$u/web/$d/public_html
    [ -f "$P/index.html" ] || continue
    excluido "$u" "$d" && continue
    px=$($H/v-list-web-domain "$u" "$d" shell 2>/dev/null | awk '$1=="PROXY:"{print $2}')
    [ "$px" = "default" ] || continue
    sed "s/$d/%domain%/g" "$P/index.html" | cmp -s - "$ORIG" || continue
    [ "$(find "$P" -mindepth 1 -maxdepth 1 ! -name index.html ! -name robots.txt ! -name favicon.ico | wc -l)" = 0 ] || continue
    servido=$(curl -sk --max-time 10 --resolve "$d:443:127.0.0.1" "https://$d/" || curl -s --max-time 10 --resolve "$d:80:127.0.0.1" "http://$d/")
    printf '%s\n' "$servido" | sed "s/$d/%domain%/g" | diff -qwB - "$ORIG" >/dev/null || continue
    if [ $VER = 1 ]; then echo "receberia a Brevemente: $u $d"; continue; fi
    mkdir -p /root/brevemente-copias && cp -a "$P/index.html" "/root/brevemente-copias/$d-index.html"
    install -m 644 -o "$u" -g "$u" "$PAGINA" "$P/index.html"
    echo "$(date '+%F %T') Brevemente posta em $d ($u)" >> "$LOG"
  done
done
