#!/bin/bash
# ============================================================
# Visual Design — Migração de Site: MozServer → VPS Hetzner
# ============================================================
# USO:  ./migrate-site.sh <dominio> 
# EXEMPLO:  ./migrate-site.sh visualdesignmoz.com
#
# REQUISITOS:
# - SSH root no VPS (37.27.17.25)
# - DirectAdmin instalado e funcional
# - Backup cPanel (.tar.gz) do site na pasta ~/backups/
# ============================================================

set -e

# ---- CONFIGURAÇÃO ----
VPS_IP="37.27.17.25"
VPS_USER="root"
VPS_PORT="22"
BACKUP_DIR="$HOME/backups"
DOMAIN="$1"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# ---- PRÉ-VERIFICAÇÕES ----
if [ -z "$DOMAIN" ]; then
  echo ""
  echo "Uso: $0 <dominio>"
  echo "Exemplo: $0 visualdesignmoz.com"
  echo ""
  echo "Antes de usar, coloque o backup cPanel em: ~/backups/"
  exit 1
fi

BACKUP_FILE=$(find "$BACKUP_DIR" -name "*${DOMAIN}*" -type f 2>/dev/null | head -1)

if [ -z "$BACKUP_FILE" ]; then
  err "Backup para '${DOMAIN}' não encontrado em ${BACKUP_DIR}/"
fi

log "Domínio:  ${DOMAIN}"
log "Backup:   ${BACKUP_FILE}"
log "VPS:      ${VPS_USER}@${VPS_IP}:${VPS_PORT}"

# ---- ETAPA 1: CRIAR SITE NO SERVER ----
step "ETAPA 1/5 — Criar website no DirectAdmin"
warn "A seguir, o script vai criar o site '${DOMAIN}' no DirectAdmin via API."
read -p "Pressione ENTER para continuar ou Ctrl+C para cancelar..."

ssh -p ${VPS_PORT} ${VPS_USER}@${VPS_IP} << REMOTE_CMD
  # Criar website via DirectAdmin CLI
  panel createWebsite --domainName ${DOMAIN} --email admin@${DOMAIN} --package Default --owner admin
  echo "Site '${DOMAIN}' criado no DirectAdmin."
REMOTE_CMD

log "Website criado no DirectAdmin!"

# ---- ETAPA 2: ENVIAR BACKUP PARA O VPS ----
step "ETAPA 2/5 — Enviar backup para o VPS"
log "A enviar $(du -h "$BACKUP_FILE" | cut -f1) para o VPS..."

scp -P ${VPS_PORT} "${BACKUP_FILE}" ${VPS_USER}@${VPS_IP}:/tmp/backup_${DOMAIN}.tar.gz

log "Backup enviado com sucesso!"

# ---- ETAPA 3: EXTRAIR FICHEIROS NO VPS ----
step "ETAPA 3/5 — Extrair e posicionar ficheiros"

ssh -p ${VPS_PORT} ${VPS_USER}@${VPS_IP} << REMOTE_CMD
  set -e
  
  SITE_ROOT="/home/${DOMAIN}/public_html"
  TEMP_DIR="/tmp/restore_${DOMAIN}"
  
  mkdir -p "\${TEMP_DIR}"
  cd "\${TEMP_DIR}"
  
  echo "Extraindo backup..."
  tar -xzf /tmp/backup_${DOMAIN}.tar.gz 2>/dev/null || tar -xf /tmp/backup_${DOMAIN}.tar.gz
  
  # Backups cPanel normalmente têm a estrutura: homedir/public_html/
  EXTRACTED_HTML=\$(find . -path "*/public_html" -type d | head -1)
  
  if [ -n "\${EXTRACTED_HTML}" ]; then
    echo "Copiando ficheiros de \${EXTRACTED_HTML} para \${SITE_ROOT}..."
    rsync -a "\${EXTRACTED_HTML}/" "\${SITE_ROOT}/"
    chown -R nobody:nobody "\${SITE_ROOT}"
    echo "Ficheiros restaurados com sucesso!"
  else
    echo "AVISO: Pasta public_html não encontrada no backup. Verifique manualmente."
  fi
  
  # Limpar
  rm -rf "\${TEMP_DIR}"
  rm -f /tmp/backup_${DOMAIN}.tar.gz
REMOTE_CMD

log "Ficheiros extraídos e posicionados!"

# ---- ETAPA 4: RESTAURAR BASE DE DADOS ----
step "ETAPA 4/5 — Restaurar base de dados MySQL"

ssh -p ${VPS_PORT} ${VPS_USER}@${VPS_IP} << 'REMOTE_CMD'
  DOMAIN_VAR="DOMAIN_PLACEHOLDER"
  TEMP_DIR="/tmp/restore_db_${DOMAIN_VAR}"
  
  # Procurar SQL dumps no backup
  mkdir -p "${TEMP_DIR}"
  
  # Listar DBs encontradas
  SQL_FILES=$(find /tmp/ -name "*.sql" -o -name "*.sql.gz" 2>/dev/null | head -5)
  
  if [ -n "${SQL_FILES}" ]; then
    echo "Ficheiros SQL encontrados:"
    echo "${SQL_FILES}"
    echo ""
    echo "Para importar manualmente, use:"
    echo "  panel createDatabase --databaseWebsite <dominio> --dbName <nome> --dbUsername <user> --dbPassword <pass>"
    echo "  mysql -u <user> -p <dbname> < ficheiro.sql"
  else
    echo "Nenhum ficheiro SQL encontrado. Verifique se o backup contém dumps de DB."
    echo ""
    echo "Para exportar manualmente do servidor antigo:"
    echo "  mysqldump -u <user> -p <database> > backup.sql"
    echo ""
    echo "Para importar no novo VPS:"
    echo "  1. Crie a DB no DirectAdmin (Websites > <dominio> > Databases)"
    echo "  2. mysql -u <user> -p <newdb> < backup.sql"
  fi
  
  rm -rf "${TEMP_DIR}"
REMOTE_CMD
REMOTE_CMD_REPLACED="${REMOTE_CMD//DOMAIN_PLACEHOLDER/${DOMAIN}}"

log "Verificação de bases de dados concluída."

# ---- ETAPA 5: VERIFICAÇÃO ----
step "ETAPA 5/5 — Verificação Final"

ssh -p ${VPS_PORT} ${VPS_USER}@${VPS_IP} << REMOTE_CMD
  SITE_ROOT="/home/${DOMAIN}/public_html"
  
  echo "=== Verificação do Site ==="
  echo "Pasta:     \${SITE_ROOT}"
  echo "Ficheiros: \$(find \${SITE_ROOT} -type f | wc -l) ficheiros"
  echo "Tamanho:   \$(du -sh \${SITE_ROOT} | cut -f1)"
  echo ""
  
  # Verificar se é WordPress
  if [ -f "\${SITE_ROOT}/wp-config.php" ]; then
    echo "CMS:       WordPress detectado!"
    echo "AÇÃO:      Actualize o wp-config.php com as novas credenciais da DB."
  fi
  
  echo ""
  echo "=== Teste de Acesso ==="
  echo "Para testar sem alterar o DNS, adicione ao seu /etc/hosts:"
  echo "  ${VPS_IP}  ${DOMAIN}"
  echo ""
  echo "Ou teste directamente via IP:"
  echo "  curl -H 'Host: ${DOMAIN}' http://${VPS_IP}/"
REMOTE_CMD

echo ""
log "Migração do site '${DOMAIN}' concluída!"
echo ""
warn "PRÓXIMOS PASSOS:"
echo "  1. Teste o site via /etc/hosts ou curl antes de alterar o DNS"
echo "  2. Actualize o wp-config.php (se WordPress) com as novas credenciais DB"
echo "  3. Configure SSL: panel issueSSL --domainName ${DOMAIN}"
echo "  4. Quando estiver tudo OK, altere o registo A do DNS para ${VPS_IP}"
echo ""
