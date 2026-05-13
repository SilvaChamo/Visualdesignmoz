#!/bin/bash
# setup-novo-site.sh
# Script para configurar um novo site no Supabase self-hosted do Contabo
# Uso: ./setup-novo-site.sh entrecampos entrecampos.pt

SITE_NAME=$1
SITE_DOMAIN=$2
ADMIN_EMAIL=${3:-"admin@${SITE_DOMAIN}"}
ADMIN_PASSWORD=${4:-"change-me-$(openssl rand -hex 8)"}

if [ -z "$SITE_NAME" ] || [ -z "$SITE_DOMAIN" ]; then
    echo "❌ Uso: $0 <nome-site> <dominio> [email] [password]"
    echo "Exemplo: $0 entrecampos entrecampos.pt admin@entrecampos.pt senha123"
    exit 1
fi

echo "🚀 Configurando novo site: $SITE_NAME ($SITE_DOMAIN)"

# Coloca num arquivo temporário as migrations SQL
cat > /tmp/setup-${SITE_NAME}.sql << EOF
-- Setup para ${SITE_NAME}

-- Tabelas base
CREATE TABLE IF NOT EXISTS sites_${SITE_NAME} (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_members_${SITE_NAME} (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT REFERENCES sites_${SITE_NAME}(id) ON DELETE CASCADE,
  user_id UUID,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emails_${SITE_NAME} (
  id BIGSERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT,
  site_id BIGINT REFERENCES sites_${SITE_NAME}(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_site_members_${SITE_NAME}_site_id ON site_members_${SITE_NAME}(site_id);
CREATE INDEX idx_site_members_${SITE_NAME}_user_id ON site_members_${SITE_NAME}(user_id);
CREATE INDEX idx_emails_${SITE_NAME}_site_id ON emails_${SITE_NAME}(site_id);

-- Dados iniciais
INSERT INTO sites_${SITE_NAME} (name, domain, description) 
VALUES ('${SITE_NAME}', '${SITE_DOMAIN}', 'Site ${SITE_NAME}');

INSERT INTO emails_${SITE_NAME} (domain, email, password, site_id)
SELECT 
  '${SITE_DOMAIN}',
  '${ADMIN_EMAIL}',
  '${ADMIN_PASSWORD}',
  id
FROM sites_${SITE_NAME} WHERE domain = '${SITE_DOMAIN}';
EOF

echo ""
echo "📝 SQL gerado em: /tmp/setup-${SITE_NAME}.sql"
echo ""
echo "✋ PRÓXIMOS PASSOS MANUAIS:"
echo "1. Abra o Studio: http://seu-ip-contabo:3000"
echo "2. Vá a SQL Editor → New query"
echo "3. Cole o conteúdo de: /tmp/setup-${SITE_NAME}.sql"
echo "4. Clique em Run"
echo ""
echo "📋 Credenciais do Site:"
echo "   Nome: ${SITE_NAME}"
echo "   Domínio: ${SITE_DOMAIN}"
echo "   Admin Email: ${ADMIN_EMAIL}"
echo "   Admin Password: ${ADMIN_PASSWORD}"
echo ""
echo "💾 Guarde isto num local seguro!"

# Copia para um arquivo de configuração
mkdir -p ~/sites-config
cat > ~/sites-config/${SITE_NAME}.env << EOF
SITE_NAME=${SITE_NAME}
SITE_DOMAIN=${SITE_DOMAIN}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF

echo "✅ Configuração guardada em: ~/sites-config/${SITE_NAME}.env"
