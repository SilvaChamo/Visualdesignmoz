#!/bin/bash
# Corrigir permissões OpenDKIM

echo "🔧 Corrigindo permissões OpenDKIM..."

# 1. Mudar proprietário do diretório para root
chown root:root /etc/opendkim
chown root:root /etc/opendkim/keys

# 2. Diretório não deve ser escrito por group/others
chmod 755 /etc/opendkim
chmod 755 /etc/opendkim/keys

# 3. Diretório do domínio - root apenas
chown root:root /etc/opendkim/keys/visualdesignmoz.com
chmod 700 /etc/opendkim/keys/visualdesignmoz.com

# 4. Chave privada - root apenas, permissão 600
chown root:root /etc/opendkim/keys/visualdesignmoz.com/default.private
chmod 600 /etc/opendkim/keys/visualdesignmoz.com/default.private

# 5. Chave pública pode ser legível
chown root:root /etc/opendkim/keys/visualdesignmoz.com/default.txt
chmod 644 /etc/opendkim/keys/visualdesignmoz.com/default.txt

# 6. Arquivo de configuração
chown root:root /etc/opendkim.conf
chmod 644 /etc/opendkim.conf

echo "✅ Permissões corrigidas!"
echo ""
echo "Verificando:"
ls -la /etc/opendkim/
ls -la /etc/opendkim/keys/visualdesignmoz.com/

echo ""
echo "Reiniciando OpenDKIM..."
systemctl restart opendkim
sleep 2
systemctl status opendkim --no-pager | head -5
