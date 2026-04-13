#!/bin/bash
set -e
SERVIDOR="109.199.104.22"
DIRETORIO="/home/visualdesign.ao/public_html"
CHAVE="/Users/macbook/.ssh/visualdesign_cyberpanel_key"

echo "🚀 Deploy Robusto VisualDesign"
echo "1. Limpando cache local..."
rm -rf .next

echo "2. Build local..."
npm run build || exit 1

echo "3. Criando diretório no servidor..."
ssh -i "$CHAVE" "root@$SERVIDOR" "mkdir -p $DIRETORIO"

echo "4. Parando PM2..."
ssh -i "$CHAVE" "root@$SERVIDOR" "pm2 stop visualdesign 2>/dev/null || true"

echo "5. Sincronizando arquivos..."
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude "*.env*" \
  -e "ssh -i $CHAVE" \
  ./ "root@$SERVIDOR:$DIRETORIO/"

echo "6. Build no servidor..."
ssh -i "$CHAVE" "root@$SERVIDOR" "cd $DIRETORIO && npm install && npm run build"

echo "7. Reiniciando PM2..."
ssh -i "$CHAVE" "root@$SERVIDOR" "cd $DIRETORIO && pm2 delete visualdesign 2>/dev/null || true; pm2 start ecosystem.config.js --name visualdesign || pm2 start 'npm start' --name visualdesign -- --port 3002"

echo "✅ Deploy concluído!"
echo "Verifique: http://$SERVIDOR:3002"
