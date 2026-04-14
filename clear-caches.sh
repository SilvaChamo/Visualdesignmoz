#!/bin/bash

# Script para limpar caches e resetar o ambiente

echo "🧹 LIMPEZA COMPLETA DE CACHES"
echo "=============================="
echo ""

# 1. Limpar .next build cache
echo "1️⃣  Limpando .next build cache..."
rm -rf /Users/macbook/Desktop/APP/visualdesign/.next
echo "✅ .next deletado"
echo ""

# 2. Limpar node_modules cache (opcional, mais lento)
# echo "2️⃣  Limpando npm cache..."
# npm cache clean --force
# echo "✅ npm cache limpo"
# echo ""

# 3. Instruções para limpar localStorage do navegador
echo "2️⃣  INSTRUÇÕES PARA LIMPAR NAVEGADOR:"
echo "────────────────────────────────────────"
echo ""
echo "🔧 Abra Developer Tools (F12) no navegador e:
"
echo "1. Abra Console (aba Console)"
echo "2. Cole este comando:"
echo ""
echo "   localStorage.clear(); sessionStorage.clear(); console.log('✅ Caches limpos')"
echo ""
echo "3. Pressione Enter"
echo "4. Recarregue a página (Ctrl+F5 ou Cmd+Shift+R)"
echo ""
echo "────────────────────────────────────────"
echo ""

# 4. Instruções para rebuild
echo "3️⃣  INSTRUÇÕES PARA REBUILD:"
echo "────────────────────────────────────────"
echo ""
echo "Reinicie o servidor com:"
echo ""
echo "  cd /Users/macbook/Desktop/APP/visualdesign"
echo "  npm run dev"
echo ""
echo "────────────────────────────────────────"
echo ""

echo "✅ Limpeza preparada!"
echo ""
echo "Próximos passos:"
echo "1. Limpe localStorage no navegador (Dev Tools > Console)"
echo "2. Recarregue a página (Ctrl+F5)"
echo "3. Verifique se a lista de emails agora mostra APENAS os 7 do CyberPanel"
echo ""
