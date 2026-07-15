#!/bin/bash
# Configuração ÚNICA do servidor para o motor de hospedagem nativo.
# Corre isto UMA VEZ, como root, no Hetzner. Depois disto, o painel já
# consegue criar contas sozinho via /api/site-manager.
#
# O que faz:
# 1. Cria a pasta onde vão viver as configurações dos sites nativos
#    (NUNCA mexe nas pastas de configuração da DirectAdmin).
# 2. Diz ao Apache para também ler ficheiros dessa pasta.
# 3. Confirma que o certbot (Let's Encrypt) está instalado.
#
# Seguro: testa a configuração antes de recarregar o Apache; se algo
# estiver mal, para e não mexe em mais nada.

set -e

NATIVE_DIR="/etc/httpd/conf/native-sites"
INCLUDE_FILE="/etc/httpd/conf/extra/native-sites.conf"
HTTPD_CONF="/etc/httpd/conf/httpd.conf"

echo "==> A criar pasta de configs nativas..."
mkdir -p "$NATIVE_DIR"

echo "==> A adicionar o include no Apache (se ainda não existir)..."
if [ ! -f "$INCLUDE_FILE" ]; then
  cat > "$INCLUDE_FILE" << EOF
# Inclui as configs dos sites do motor nativo (fora da DirectAdmin).
# Gerado por scripts/setup-native-hosting.sh — não editar à mão.
IncludeOptional ${NATIVE_DIR}/*.conf
EOF
  echo "    Criado: $INCLUDE_FILE"
fi

# A DirectAdmin usa /etc/httpd/conf/extra/ (não /etc/httpd/conf.d/), por
# isso o ficheiro acima só é lido se houver um "Include" a apontar para ele
# no httpd.conf principal.
if ! grep -q "native-sites.conf" "$HTTPD_CONF"; then
  echo "Include conf/extra/native-sites.conf" >> "$HTTPD_CONF"
  echo "    Adicionada linha Include ao $HTTPD_CONF"
else
  echo "    Include já existia no $HTTPD_CONF, não mexi."
fi

echo "==> A testar a configuração do Apache..."
if ! apachectl configtest; then
  echo "ERRO: a configuração do Apache ficou inválida. A reverter tudo..."
  rm -f "$INCLUDE_FILE"
  sed -i '/native-sites\.conf/d' "$HTTPD_CONF"
  exit 1
fi

echo "==> A recarregar o Apache..."
systemctl reload httpd

echo "==> A confirmar que o certbot está instalado..."
if ! command -v certbot &> /dev/null; then
  echo "    certbot não encontrado — a instalar (Let's Encrypt, grátis)..."
  if command -v dnf &> /dev/null; then
    dnf install -y certbot python3-certbot-apache
  elif command -v yum &> /dev/null; then
    yum install -y certbot python3-certbot-apache
  elif command -v apt-get &> /dev/null; then
    apt-get update && apt-get install -y certbot python3-certbot-apache
  else
    echo "    AVISO: não consegui detectar o gestor de pacotes. Instala o certbot manualmente."
  fi
else
  echo "    Já está instalado."
fi

echo
echo "✅ Pronto. O motor nativo já pode criar contas."
echo "   Pasta de configs: $NATIVE_DIR"
echo "   Testa criando um site de teste pelo painel (botão em Admin > Hospedagem Nativa)."
