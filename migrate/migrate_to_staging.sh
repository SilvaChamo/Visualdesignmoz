#!/bin/bash
# Script de migração automática para staging no Contabo

echo "=== MIGRAÇÃO AUTOMÁTICA PARA STAGING CONTABO ==="
echo "Origem: yknrnlev@za4.mozserver.com"
echo "Destino: root@109.199.104.22"
echo "Data: $(date)"
echo ""

# Criar ambiente staging no Contabo
echo "🏗️  Criando ambiente staging..."

# Usar nossa API para configurar ambiente staging
curl -X POST http://localhost:3002/api/server-exec \
  -H "Content-Type: application/json" \
  -d '{
    "command": "mkdir -p /home/staging_sites /home/migration_backups /var/www/staging && echo \"Diretórios criados com sucesso\"",
    "server": "contabo"
  }' 2>/dev/null

# Criar banco de dados para staging
curl -X POST http://localhost:3002/api/server-exec \
  -H "Content-Type: application/json" \
  -d '{
    "command": "mysql -u root -pAd.Vd#2425?* -e \"CREATE DATABASE IF NOT EXISTS staging_visualdesign; CREATE DATABASE IF NOT EXISTS staging_sites;\" && echo \"Bancos staging criados\"",
    "server": "contabo"
  }' 2>/dev/null

# Configurar Nginx para staging
curl -X POST http://localhost:3002/api/server-exec \
  -H "Content-Type: application/json" \
  -d '{
    "command": "cat > /etc/nginx/sites-available/staging.visualdesignmoz.com << \"EOF\"\nserver {\n    listen 80;\n    server_name staging.visualdesignmoz.com;\n    root /var/www/staging;\n    index index.php index.html;\n    \n    location / {\n        try_files \\$uri \\$uri/ /index.php?\\$query_string;\n    }\n    \n    location ~ \\.php$ {\n        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;\n        fastcgi_index index.php;\n        fastcgi_param SCRIPT_FILENAME \\$document_root\\$fastcgi_script_name;\n        include fastcgi_params;\n    }\n}\nEOF",
    "server": "contabo"
  }' 2>/dev/null

# Ativar site staging
curl -X POST http://localhost:3002/api/server-exec \
  -H "Content-Type: application/json" \
  -d '{
    "command": "ln -sf /etc/nginx/sites-available/staging.visualdesignmoz.com /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx && echo \"Site staging ativado\"",
    "server": "contabo"
  }' 2>/dev/null

echo "✅ Ambiente staging criado!"
echo "🌐 Staging URL: http://staging.visualdesignmoz.com"
echo ""

# Lista de sites para migrar (vamos descobrir automaticamente)
echo "🔍 Descobrindo sites para migrar..."

# Descobrir sites no MozServer
SITES_TO_MIGRATE=$(curl -X POST http://localhost:3002/api/server-exec \
  -H "Content-Type: application/json" \
  -d '{
    "command": "find /home -name \"wp-config.php\" -type f 2>/dev/null | dirname",
    "server": "mozserver"
  }' 2>/dev/null | jq -r '.data.output' | tr '\n' ' ')

echo "📋 Sites encontrados: $SITES_TO_MIGRATE"

# Migrar cada site
for site_path in $SITES_TO_MIGRATE; do
    if [ ! -z "$site_path" ]; then
        site_name=$(basename "$site_path")
        echo ""
        echo "🔄 Migrando: $site_name"
        
        # Backup dos arquivos no MozServer
        echo "   📦 Backup dos arquivos..."
        DATE=$(date +%Y%m%d_%H%M%S)
        
        curl -X POST http://localhost:3002/api/server-exec \
          -H "Content-Type: application/json" \
          -d "{
            \"command\": \"tar -czf /tmp/${site_name}_files_${DATE}.tar.gz -C ${site_path} . && echo 'Backup arquivos concluído'\",
            \"server\": \"mozserver\"
          }" 2>/dev/null
        
        # Transferir arquivos para Contabo
        echo "   🚚 Transferindo arquivos..."
        
        # Copiar via SSH direto
        ssh yknrnlev@za4.mozserver.com "scp /tmp/${site_name}_files_${DATE}.tar.gz root@109.199.104.22:/tmp/" 2>/dev/null
        
        # Extrair arquivos no Contabo
        curl -X POST http://localhost:3002/api/server-exec \
          -H "Content-Type: application/json" \
          -d "{
            \"command\": \"mkdir -p /var/www/staging/${site_name} && tar -xzf /tmp/${site_name}_files_${DATE}.tar.gz -C /var/www/staging/${site_name} && echo 'Arquivos extraídos'\",
            \"server\": \"contabo\"
          }" 2>/dev/null
        
        # Backup do banco de dados
        echo "   🗄️  Backup do banco..."
        
        # Obter nome do banco do wp-config.php
        db_name=$(ssh yknrnlev@za4.mozserver.com "grep \"DB_NAME\" ${site_path}/wp-config.php | cut -d \"'\" -f 4" 2>/dev/null || echo "")
        
        if [ ! -z "$db_name" ]; then
            # Exportar banco
            ssh yknrnlev@za4.mozserver.com "mysqldump -u root -p $db_name | gzip > /tmp/${site_name}_db_${DATE}.sql.gz" 2>/dev/null
            
            # Transferir banco
            ssh yknrnlev@za4.mozserver.com "scp /tmp/${site_name}_db_${DATE}.sql.gz root@109.199.104.22:/tmp/" 2>/dev/null
            
            # Importar para staging
            curl -X POST http://localhost:3002/api/server-exec \
              -H "Content-Type: application/json" \
              -d "{
                \"command\": \"gunzip < /tmp/${site_name}_db_${DATE}.sql.gz | mysql -u root -pAd.Vd#2425?* staging_${site_name} && echo 'Banco importado'\",
                \"server\": \"contabo\"
              }" 2>/dev/null
            
            # Ajustar wp-config.php
            curl -X POST http://localhost:3002/api/server-exec \
              -H "Content-Type: application/json" \
              -d "{
                \"command\": \"sed -i \\\"s/define('DB_NAME', '[^']*');/define('DB_NAME', 'staging_${site_name}');/\\\" /var/www/staging/${site_name}/wp-config.php && echo 'wp-config.php ajustado'\",
                \"server\": \"contabo\"
              }" 2>/dev/null
            
            echo "   ✅ $site_name migrado para staging!"
            echo "   🌐 http://staging.visualdesignmoz.com/${site_name}"
        else
            echo "   ❌ Não foi possível determinar o nome do banco"
        fi
    fi
done

echo ""
echo "🎉 MIGRAÇÃO STAGING CONCLUÍDA!"
echo "📋 Resumo:"
echo "   🗄️  Bancos criados: staging_visualdesign, staging_sites"
echo "   🌐 Staging URL: http://staging.visualdesignmoz.com"
echo "   📁 Diretório staging: /var/www/staging/"
echo ""
echo "🔍 Próximo passo: Testar sites em staging"
