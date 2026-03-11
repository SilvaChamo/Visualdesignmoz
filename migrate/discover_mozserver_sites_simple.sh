#!/bin/bash
# Script simplificado de descoberta (sem jq)

echo "=== DESCOBRINDO SITES WORDPRESS NO MOZSERVER ==="
echo "Servidor: za4.mozserver.com"
echo "Usuário: yknrnlev"
echo "Data: $(date)"
echo ""

# Descobrir instalações WordPress diretamente via SSH
echo "🔍 Conectando ao MozServer para descobrir sites..."

# Executar comando diretamente no MozServer
ssh yknrnlev@za4.mozserver.com << 'EOF'
echo "=== SITES WORDPRESS ENCONTRADOS ==="
echo ""

# Procurar wp-config.php files
find /home -name "wp-config.php" -type f 2>/dev/null | while read config; do
    if [ -f "$config" ]; then
        site_dir=$(dirname "$config")
        site_name=$(basename "$site_dir")
        
        echo "📊 SITE: $site_name"
        echo "   📁 Diretório: $site_dir"
        
        # Extrair informações básicas
        if [ -f "$site_dir/wp-login.php" ]; then
            echo "   ✅ WordPress válido"
            
            # Verificar tamanho
            if [ -d "$site_dir" ]; then
                size=$(du -sh "$site_dir" 2>/dev/null | cut -f1 || echo "N/A")
                echo "   📏 Tamanho: $size"
            fi
            
            # Contar plugins
            if [ -d "$site_dir/wp-content/plugins" ]; then
                plugin_count=$(find "$site_dir/wp-content/plugins" -maxdepth 1 -type d 2>/dev/null | wc -l)
                echo "   🔌 Plugins: $((plugin_count-1))"
            fi
            
            # Contar temas
            if [ -d "$site_dir/wp-content/themes" ]; then
                theme_count=$(find "$site_dir/wp-content/themes" -maxdepth 1 -type d 2>/dev/null | wc -l)
                echo "   🎨 Temas: $((theme_count-1))"
            fi
        else
            echo "   ❌ WordPress inválido"
        fi
        
        echo ""
    fi
done

echo "🗄️  LISTA DE DIRETÓRIOS /HOME:"
ls -la /home/ | grep "^d" | awk '{print "   📁 " $9}'

echo ""
echo "✅ DESCUBERTA CONCLUÍDA NO MOZSERVER!"
EOF

echo ""
echo "📋 ANALISANDO RESULTADOS..."
echo "🔍 Verificando acessibilidade ao MozServer..."

# Testar conexão SSH
if ssh -o ConnectTimeout=10 yknrnlev@za4.mozserver.com "echo 'SSH OK'" 2>/dev/null; then
    echo "✅ Conexão SSH com MozServer funcionando!"
else
    echo "❌ Erro na conexão SSH com MozServer"
    echo "💡 Verifique:"
    echo "   - Se o servidor za4.mozserver.com está acessível"
    echo "   - Se a chave SSH está configurada"
    echo "   - Se o usuário yknrnlev tem acesso"
fi

echo ""
echo "🎯 PRÓXIMOS PASSOS:"
echo "1. ✅ Descoberta de sites concluída"
echo "2. 🔄 Criar ambiente staging no Contabo"
echo "3. 📦 Migrar sites para staging"
echo "4. 🧪 Testar funcionalidades"
echo "5. 🚀 Migração final zero downtime"
