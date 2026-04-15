#!/bin/bash
# Script para configurar SPF e DKIM no servidor CyberPanel
# Autor: VisualDesign
# Data: 2026-04-15

set -e

echo "=========================================="
echo "🔧 CONFIGURAÇÃO SPF E DKIM"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variáveis
DOMAIN="visualdesigne.com"
SERVER_IP="109.199.104.22"
SELECTOR="mail"
DKIM_DIR="/etc/opendkim"

echo -e "${YELLOW}1️⃣ Instalando OpenDKIM...${NC}"
apt-get update -qq
apt-get install -y -qq opendkim opendkim-tools

echo -e "${GREEN}✅ OpenDKIM instalado${NC}"
echo ""

# Criar diretórios
echo -e "${YELLOW}2️⃣ Criando diretórios...${NC}"
mkdir -p $DKIM_DIR/keys/$DOMAIN
chown -R opendkim:opendkim $DKIM_DIR
chmod 755 $DKIM_DIR
chmod 755 $DKIM_DIR/keys
chmod 700 $DKIM_DIR/keys/$DOMAIN

echo -e "${GREEN}✅ Diretórios criados${NC}"
echo ""

# Gerar chaves DKIM
echo -e "${YELLOW}3️⃣ Gerando chaves DKIM...${NC}"
cd $DKIM_DIR/keys/$DOMAIN

# Remover chaves antigas se existirem
rm -f ${SELECTOR}.private ${SELECTOR}.txt

# Gerar nova chave
opendkim-genkey -b 2048 -d $DOMAIN -s $SELECTOR -D $DKIM_DIR/keys/$DOMAIN/
chown opendkim:opendkim ${SELECTOR}.private
chmod 600 ${SELECTOR}.private
chmod 644 ${SELECTOR}.txt

echo -e "${GREEN}✅ Chaves DKIM geradas${NC}"
echo ""

# Configurar OpenDKIM
echo -e "${YELLOW}4️⃣ Configurando OpenDKIM...${NC}"

cat > /etc/opendkim.conf << 'EOF'
# Configuração OpenDKIM
Syslog                  yes
LogWhy                  yes

# Modo de operação
Mode                    sv
Canonicalization        relaxed/relaxed

# Seletor
Selector                mail

# Domínios assinados
Domain                  visualdesigne.com
KeyFile                 /etc/opendkim/keys/visualdesigne.com/mail.private

# Socket
Socket                  inet:8891@localhost

# Tamanho da chave
SignatureAlgorithm      rsa-sha256

# Headers a assinar
SignHeaders             From, To, Subject, Date, Message-Id, MIME-Version, Content-Type
EOF

echo -e "${GREEN}✅ OpenDKIM configurado${NC}"
echo ""

# Configurar domínios no OpenDKIM
echo -e "${YELLOW}5️⃣ Configurando domínios...${NC}"
echo "visualdesigne.com mail:/etc/opendkim/keys/visualdesigne.com/mail.private" > /etc/opendkim/key.table
echo "*@visualdesigne.com visualdesigne.com" > /etc/opendkim/signing.table
echo "109.199.104.22/32" > /etc/opendkim/trusted.hosts
echo "localhost" >> /etc/opendkim/trusted.hosts
echo "127.0.0.1" >> /etc/opendkim/trusted.hosts

echo -e "${GREEN}✅ Domínios configurados${NC}"
echo ""

# Configurar Postfix para usar DKIM
echo -e "${YELLOW}6️⃣ Configurando Postfix...${NC}"

# Adicionar configurações DKIM ao Postfix
postconf -e "smtpd_milters = inet:localhost:8891"
postconf -e "non_smtpd_milters = inet:localhost:8891"
postconf -e "milter_default_action = accept"
postconf -e "milter_protocol = 6"

# Configurar SPF no Postfix (policyd-spf)
postconf -e "policy-spf_time_limit = 3600s"

# Adicionar SPF ao smtpd_recipient_restrictions existente
RESTRICTIONS=$(postconf -h smtpd_recipient_restrictions)
if [[ ! $RESTRICTIONS == *"check_policy_service"* ]]; then
    postconf -e "smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination, check_policy_service unix:private/policy-spf"
fi

echo -e "${GREEN}✅ Postfix configurado${NC}"
echo ""

# Configurar SPF no hostname
echo -e "${YELLOW}7️⃣ Configurando hostname e SPF local...${NC}"

# Atualizar /etc/hosts
cat > /etc/hosts << EOF
127.0.0.1       localhost
$SERVER_IP      vmi3097666.visualdesigne.com vmi3097666 mail.visualdesigne.com visualdesigne.com

# The following lines are desirable for IPv6 capable hosts
::1     localhost ip6-localhost ip6-loopback
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters
EOF

echo -e "${GREEN}✅ Hosts configurado${NC}"
echo ""

# Reiniciar serviços
echo -e "${YELLOW}8️⃣ Reiniciando serviços...${NC}"
systemctl restart opendkim
systemctl enable opendkim
systemctl restart postfix

echo -e "${GREEN}✅ Serviços reiniciados${NC}"
echo ""

# Verificar status
echo -e "${YELLOW}9️⃣ Verificando status...${NC}"
systemctl is-active opendkim && echo -e "${GREEN}✅ OpenDKIM rodando${NC}" || echo -e "${RED}❌ OpenDKIM não está rodando${NC}"
systemctl is-active postfix && echo -e "${GREEN}✅ Postfix rodando${NC}" || echo -e "${RED}❌ Postfix não está rodando${NC}"
echo ""

# Mostrar registros DNS
echo "=========================================="
echo "📋 REGISTROS DNS PARA ADICIONAR"
echo "=========================================="
echo ""
echo -e "${YELLOW}1. Registro SPF (Tipo: TXT)${NC}"
echo "   Nome: $DOMAIN"
echo "   Valor: v=spf1 ip4:$SERVER_IP ip6:2a02:c207:2309:7666::1 a:mail.$DOMAIN ~all"
echo ""
echo -e "${YELLOW}2. Registro DKIM (Tipo: TXT)${NC}"
echo "   Nome: ${SELECTOR}._domainkey.$DOMAIN"
echo "   Valor:"
cat $DKIM_DIR/keys/$DOMAIN/${SELECTOR}.txt | grep -o 'v=DKIM1.*' | fold -s -w 70

echo ""
echo "=========================================="
echo "✅ CONFIGURAÇÃO CONCLUÍDA!"
echo "=========================================="
echo ""
echo "Próximos passos:"
echo "1. Adicione os registros DNS acima no seu provedor (CloudFlare/Registro.br)"
echo "2. Aguarde 5-10 minutos para propagação"
echo "3. Teste enviando um email para Gmail"
echo ""
echo "Comando para testar:"
echo "   echo 'Teste DKIM/SPF' | mail -s 'Teste Autenticação' silva.chamo@gmail.com"
echo ""
