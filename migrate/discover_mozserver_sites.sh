#!/bin/bash
# Script de descoberta automática de sites WordPress no MozServer

echo "=== DESCOBRINDO SITES WORDPRESS NO MOZSERVER ==="
echo "Servidor: za4.mozserver.com"
echo "Usuário: yknrnlev"
echo "Data: $(date)"
echo ""

# Função para executar comandos no MozServer via SSH
exec_mozserver() {
    ssh yknrnlev@za4.mozserver.com "$1"
}

# Descobrir instalações WordPress
echo "🔍 Procurando instalações WordPress..."
echo ""

# Usar nossa API de server-exec para acessar MozServer
curl -X POST http://localhost:3002/api/server-exec \
  -H "Content-Type: application/json" \
  -d '{
    "command": "find /home -name \"wp-config.php\" -type f 2>/dev/null | head -20",
    "server": "mozserver"
  }' 2>/dev/null | jq -r '.data.output' | while read config; do
    if [ ! -z "$config" ] && [ -f "$config" ]; then
        site_dir=$(dirname "$config")
        site_name=$(basename "$site_dir")
        
        echo "📊 SITE: $site_name"
        echo "   📁 Diretório: $site_dir"
        
        # Extrair informações do wp-config.php
        db_name=$(grep "DB_NAME" "$config" | cut -d "'" -f 4 2>/dev/null || echo "N/A")
        db_user=$(grep "DB_USER" "$config" | cut -d "'" -f 4 2>/dev/null || echo "N/A")
        table_prefix=$(grep "\$table_prefix" "$config" | cut -d "'" -f 2 2>/dev/null || echo "wp_")
        
        echo "   🗄️  Banco: $db_name"
        echo "   👤 Usuário: $db_user"
        echo "   🔐 Prefixo: $table_prefix"
        
        # Verificar se é site WordPress válido
        if [ -f "$site_dir/wp-login.php" ]; then
            echo "   ✅ WordPress válido"
            
            # Verificar plugins
            if [ -d "$site_dir/wp-content/plugins" ]; then
                plugin_count=$(find "$site_dir/wp-content/plugins" -maxdepth 1 -type d 2>/dev/null | wc -l)
                echo "   🔌 Plugins: $((plugin_count-1))"
            fi
            
            # Verificar temas
            if [ -d "$site_dir/wp-content/themes" ]; then
                theme_count=$(find "$site_dir/wp-content/themes" -maxdepth 1 -type d 2>/dev/null | wc -l)
                echo "   🎨 Temas: $((theme_count-1))"
            fi
            
            # Verificar tamanho
            if [ -d "$site_dir" ]; then
                size=$(du -sh "$site_dir" 2>/dev/null | cut -f1 || echo "N/A")
                echo "   📏 Tamanho: $size"
            fi
            
            # Verificar URL do site
            if [ -f "$site_dir/wp-config.php" ]; then
                site_url=$(grep "WP_HOME\|WP_SITEURL" "$site_dir/wp-config.php" 2>/dev/null | head -1 | cut -d "'" -f 4 || echo "N/A")
                echo "   🌐 URL: $site_url"
            fi
        else
            echo "   ❌ WordPress inválido"
        fi
        
        echo ""
    fi
done

echo "🗄️  BANCOS DE DADOS DISPONÍVEIS:"
curl -X POST http://localhost:3002/api/server-exec \
  -H "Content-Type: application/json" \
  -d '{
    "command": "mysql -u root -p -e \"SHOW DATABASES;\" 2>/dev/null | grep -v \"Database\\|information_schema\\|performance_schema\\|mysql\"",
    "server": "mozserver"
  }' 2>/dev/null | jq -r '.data.output'

echo ""
echo "✅ DESCOBERTA CONCLUÍDA!"
echo "📋 Próximo passo: Criar plano de migração personalizado"
