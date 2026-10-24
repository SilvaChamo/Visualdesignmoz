#!/bin/bash
# Verificar configuração de email e DNS para evitar spam

echo "📧 VERIFICAÇÃO DE ENTREGABILIDADE DE EMAIL"
echo "=========================================="
echo ""

SERVER="37.27.17.25"

echo "🔍 Verificando domínios hospedados..."
DOMAINS=$(ssh root@$SERVER "mysql panel -N -e \"SELECT domain FROM websites_website WHERE domain NOT LIKE '%contaboserver%';\" 2>/dev/null")
echo "Domínios: $DOMAINS"
echo ""

for DOMAIN in $DOMAINS; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🌐 Domínio: $DOMAIN"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # 1. SPF
    echo ""
    echo "📋 1. SPF Record:"
    SPF=$(dig +short TXT "$DOMAIN" 2>/dev/null | grep "v=spf1")
    if [ -z "$SPF" ]; then
        echo "   ❌ NENHUM SPF encontrado!"
        echo "   → Adicione: v=spf1 a mx ip4:37.27.17.25 ~all"
    else
        echo "   ✅ $SPF"
    fi
    
    # 2. DKIM
    echo ""
    echo "📋 2. DKIM Record:"
    DKIM=$(ssh root@$SERVER "cat /etc/opendkim/keys/${DOMAIN}/mail.txt 2>/dev/null || echo ''")
    DKIM_DNS=$(dig +short TXT "default._domainkey.$DOMAIN" 2>/dev/null)
    if [ -z "$DKIM_DNS" ]; then
        echo "   ❌ DKIM não encontrado no DNS!"
        echo "   → Ative DKIM no DirectAdmin e adicione o registo TXT"
    else
        echo "   ✅ DKIM encontrado no DNS"
    fi
    
    # 3. DMARC
    echo ""
    echo "📋 3. DMARC Record:"
    DMARC=$(dig +short TXT "_dmarc.$DOMAIN" 2>/dev/null)
    if [ -z "$DMARC" ]; then
        echo "   ❌ NENHUM DMARC encontrado!"
        echo "   → Adicione: v=DMARC1; p=none; rua=mailto:postmaster@${DOMAIN}"
    else
        echo "   ✅ $DMARC"
    fi
    
    # 4. rDNS (Reverse DNS)
    echo ""
    echo "📋 4. Reverse DNS (PTR):"
    PTR=$(dig +short -x 37.27.17.25 2>/dev/null)
    if [ -z "$PTR" ]; then
        echo "   ❌ Nenhum PTR configurado para 37.27.17.25"
    else
        echo "   ✅ $PTR"
    fi
    
    # 5. IP em blacklists
    echo ""
    echo "📋 5. Verificação rápida de blacklist:"
    BL_RESULT=$(dig +short 22.104.199.109.zen.spamhaus.org 2>/dev/null)
    if [ -z "$BL_RESULT" ]; then
        echo "   ✅ IP não está na Spamhaus ZEN"
    else
        echo "   ❌ IP listado na Spamhaus! Código: $BL_RESULT"
    fi
    
    echo ""
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMO DE CORREÇÕES NECESSÁRIAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Para evitar spam, certifique-se que CADA domínio tem:"
echo "  1. ✅ SPF:    v=spf1 a mx ip4:37.27.17.25 ~all"
echo "  2. ✅ DKIM:   Ativar no DirectAdmin → Adicionar registo TXT no DNS"
echo "  3. ✅ DMARC:  v=DMARC1; p=none; rua=mailto:postmaster@DOMINIO"
echo "  4. ✅ rDNS:   Contactar Hetzner para configurar PTR do IP"
echo ""
echo "🔧 Para ativar DKIM em todos os domínios:"
echo "   ssh root@$SERVER 'for d in \$(mysql panel -N -e \"SELECT domain FROM websites_website WHERE domain NOT LIKE '%contaboserver%';\"); do panel issueDKIM --domainName \$d 2>/dev/null; done'"
