#!/bin/bash
echo "Iniciando Deploy da VisualDesign..."
cd /home/visualdesigne.com/public_html || exit
git pull origin main
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
npm install
npm run build
pm2 restart visualdesign || pm2 start npm --name "visualdesign" -- start -- -p 3002
pm2 save
echo "Deploy Concluído!"
