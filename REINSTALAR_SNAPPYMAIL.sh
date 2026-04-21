#!/bin/bash
# Reinstalação completa do SnappyMail

echo "=== LIMPANDO INSTALAÇAO ANTIGA ==="
rm -rf /usr/local/CyberCP/public/snappymail

echo "=== CRIANDO ESTRUTURA ==="
mkdir -p /usr/local/CyberCP/public/snappymail
cd /usr/local/CyberCP/public/snappymail

echo "=== VERIFICANDO ARQUIVO BAIXADO ==="
if [ -f "/tmp/latest.tar.gz" ]; then
    echo "✓ Arquivo encontrado em /tmp/latest.tar.gz"
    cp /tmp/latest.tar.gz .
elif [ -f "/root/latest.tar.gz" ]; then
    echo "✓ Arquivo encontrado em /root/latest.tar.gz"
    cp /root/latest.tar.gz .
else
    echo "✗ Arquivo latest.tar.gz não encontrado"
    echo "Baixando do GitHub..."
    curl -L -o latest.tar.gz "https://github.com/the-djmaze/snappymail/releases/download/v2.38.2/snappymail-2.38.2.tar.gz"
fi

echo "=== EXTRAINDO ARQUIVOS ==="
tar -xzf latest.tar.gz

# Verificar estrutura
if [ -d "snappymail" ]; then
    echo "Movendo arquivos da subpasta..."
    mv snappymail/* . 2>/dev/null || true
    rm -rf snappymail
fi

if [ -d "v/2.38.2" ]; then
    echo "Movendo arquivos de v/2.38.2..."
    mv v/2.38.2/* . 2>/dev/null || true
    rm -rf v
fi

echo "=== CONFIGURANDO ==="
rm -f latest.tar.gz
mkdir -p data
chmod -R 777 data
chown -R lscpd:lscpd /usr/local/CyberCP/public/snappymail/
chmod -R 755 /usr/local/CyberCP/public/snappymail/

echo "=== VERIFICANDO ==="
echo "Arquivos na raiz:"
ls -la | head -20

echo ""
echo "Verificando index.php..."
if [ -f "index.php" ]; then
    echo "✓ index.php existe ($(stat -c%s index.php) bytes)"
    head -3 index.php
else
    echo "✗ index.php não encontrado!"
fi

echo ""
echo "Verificando app/index.php..."
if [ -f "app/index.php" ]; then
    echo "✓ app/index.php existe"
else
    echo "✗ app/index.php não encontrado!"
    echo "Conteúdo da pasta app:"
    ls -la app/ 2>/dev/null || echo "(pasta app não existe)"
fi

echo ""
echo "=== REINICIANDO WEB SERVER ==="
/usr/local/lsws/bin/lswsctrl restart

echo "✅ Concluído!"
echo "Teste em: https://109.199.104.22:8090/snappymail/index.php"
