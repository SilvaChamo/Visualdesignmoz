import { NextRequest, NextResponse } from 'next/server';
import { executeCyberPanelCommand } from '@/lib/cyberpanel-exec';
import { createClient } from '@/utils/supabase/server';

const adminEmails = ['admin@your-domain.com', 'silva.chamo@gmail.com', 'geral@your-domain.com'];

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    // Bloqueio interno: Só permitimos se houver sessão ativa
    if (!session) {
        return NextResponse.json({ error: 'Não autorizado. Identidade não verificada.' }, { status: 401 });
    }

    // Bloqueio de Role: Só admin pode gerir WordPress
    const userRole = session.user?.user_metadata?.role;
    const isExplicitAdmin = adminEmails.includes(session.user?.email || '');
    if (userRole !== 'admin' && !isExplicitAdmin) {
        return NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { action } = body;

        switch (action) {
            case 'installWordPress': {
                const { 
                    protocol, domain, directory, version, siteName, siteDescription,
                    enableMultisite, disableWPCron,
                    adminUsername, adminPassword, adminEmail,
                    databaseName, databaseUser, databasePassword,
                    plugins
                } = body;

                if (!domain || !siteName || !adminUsername || !adminPassword || !adminEmail) {
                    return NextResponse.json({ error: 'Faltam parâmetros obrigatórios' }, { status: 400 });
                }
                
                const wpUrl = `${protocol || 'https'}://${domain}${directory ? '/' + directory : ''}`;

                // Try CyberPanel API proxy first (no SSH needed)
                try {
                    const cpUrl = process.env.CYBERPANEL_URL || 'https://109.199.104.22:8090/api';
                    const https = require('https');
                    const agent = new https.Agent({ rejectUnauthorized: false });
                    const proxyBody = JSON.stringify({
                        adminUser: process.env.CYBERPANEL_USER || 'admin',
                        adminPass: process.env.CYBERPANEL_PASS || 'Vgz5Zat4uMyFt2tb',
                        domainName: domain,
                        wpTitle: siteName,
                        wpUser: adminUsername,
                        wpPassword: adminPassword,
                        wpEmail: adminEmail,
                        wpVersion: version || 'latest',
                        path: directory || '',
                        protocol: protocol || 'https'
                    });
                    const proxyRes = await fetch(`${cpUrl.replace('/api', '')}/api/installWordPress`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: proxyBody,
                        // @ts-ignore
                        agent
                    }).catch(() => null);
                    if (proxyRes && proxyRes.ok) {
                        const proxyData = await proxyRes.json().catch(() => ({}));
                        if (proxyData.status === 1 || proxyData.success === true) {
                            return NextResponse.json({ success: true, message: 'WordPress instalado via API CyberPanel' });
                        }
                    }
                } catch { /* fall through to SSH */ }

                // SSH fallback
                if (!process.env.CYBERPANEL_SSH_PASS && !process.env.CYBERPANEL_SSH_KEY && !process.env.CYBERPANEL_SSH_KEY_PATH && process.env.CYBERPANEL_USE_LOCAL_EXEC !== 'true') {
                    return NextResponse.json({ success: true, message: 'WordPress marcado para instalação. Configure SSH ou instale manualmente via CyberPanel.', warning: true });
                }

                const installScript = `
                echo "--- STARTING WORDPRESS INSTALLATION ---"
                DOCUMENT_ROOT="/home/${domain}/public_html${directory ? '/' + (directory.startsWith('/') ? directory.substring(1) : directory) : ''}"
                
                if [ ! -d "/home/${domain}/public_html" ]; then
                    echo "ERRO: O diretório base /home/${domain}/public_html não existe."
                    exit 1
                fi
                
                mkdir -p "$DOCUMENT_ROOT"
                cd "$DOCUMENT_ROOT"
                echo "Diretório de trabalho: $(pwd)"
                
                # Download WP-CLI if not present
                if ! command -v wp &> /dev/null; then
                    echo "Instalando WP-CLI..."
                    curl -s -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
                    chmod +x wp-cli.phar
                    mv wp-cli.phar /usr/local/bin/wp
                fi
                
                # Create Database first if not exists
                DB_NAME="${databaseName || domain.replace(/\./g,'_') + '_wp'}"
                DB_USER="${databaseUser || 'usr_' + domain.replace(/\./g,'_').substring(0,8)}"
                DB_PASS='${databasePassword || 'generated_pass'}'
                
                echo "Passo 1: Criando base de dados $DB_NAME..."
                /usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/mysqlUtilities.py createDatabase --domainName ${domain} --dbName "$DB_NAME" --dbUsername "$DB_USER" --dbPassword "$DB_PASS"
                
                # Download specific WP version if requested
                WP_VERSION="${version || 'latest'}"
                echo "Passo 2: Descarregando WordPress $WP_VERSION..."
                WP_CLI_ALLOW_ROOT=1 wp core download --version="$WP_VERSION" --allow-root --force --locale=pt_PT
                if [ $? -ne 0 ]; then echo "ERRO: Falha ao descarregar WordPress"; exit 1; fi
                
                # Configure wp-config.php
                echo "Passo 3: Configurando wp-config.php..."
                WP_CLI_ALLOW_ROOT=1 wp config create --dbname="$DB_NAME" --dbuser="$DB_USER" --dbpass="$DB_PASS" --allow-root --force
                if [ $? -ne 0 ]; then echo "ERRO: Falha ao configurar wp-config.php. Verifique se a BD foi criada."; exit 1; fi
                
                # Install WP with all settings
                echo "Passo 4: Executando instalação core..."
                WP_CLI_ALLOW_ROOT=1 wp core install --url="${wpUrl}" --title="${siteName}" --admin_user="${adminUsername}" --admin_password="${adminPassword}" --admin_email="${adminEmail}" --allow-root
                if [ $? -ne 0 ]; then echo "ERRO: Falha na instalação core"; exit 1; fi
                
                # Set site description/tagline if provided
                ${siteDescription ? `echo "Passo 5: Atualizando descrição..." && WP_CLI_ALLOW_ROOT=1 wp option update blogdescription "${siteDescription}" --allow-root` : ''}
                
                # Configure Multisite if enabled
                ${enableMultisite ? `echo "Passo 6: Convertendo para Multisite..." && WP_CLI_ALLOW_ROOT=1 wp core multisite convert --allow-root` : ''}
                
                # Disable WP Cron if requested
                ${disableWPCron ? `echo "Passo 7: Desativando WP Cron..." && WP_CLI_ALLOW_ROOT=1 wp config set DISABLE_WP_CRON true --raw --allow-root` : ''}
                
                # Install selected plugins
                echo "Passo 8: Instalando plugins selecionados..."
                ${plugins?.woocommerce ? `WP_CLI_ALLOW_ROOT=1 wp plugin install woocommerce --activate --allow-root` : ''}
                ${plugins?.yoast ? `WP_CLI_ALLOW_ROOT=1 wp plugin install wordpress-seo --activate --allow-root` : ''}
                ${plugins?.wordfence ? `WP_CLI_ALLOW_ROOT=1 wp plugin install wordfence --activate --allow-root` : ''}
                ${plugins?.litespeed ? `WP_CLI_ALLOW_ROOT=1 wp plugin install litespeed-cache --activate --allow-root` : ''}
                
                # Fix permissions
                echo "Passo 9: Ajustando permissões..."
                SITE_USER=$(stat -c '%U' "/home/${domain}/public_html")
                chown -R "$SITE_USER":"$SITE_USER" "$DOCUMENT_ROOT"
                find "$DOCUMENT_ROOT" -type f -exec chmod 644 {} \;
                find "$DOCUMENT_ROOT" -type d -exec chmod 755 {} \;
                
                echo "--- SUCESSO: WordPress $WP_VERSION instalado em ${wpUrl} ---"
                `;

                const result = await executeCyberPanelCommand(installScript);

                if (result.includes("ERRO:")) {
                    return NextResponse.json({ error: 'Falha ao instalar o WordPress', details: result }, { status: 400 });
                }

                // Atualizar siteType para 'wordpress' no Supabase
                try {
                    await supabase
                        .from('cyberpanel_sites')
                        .update({ site_type: 'wordpress' })
                        .eq('domain', domain);
                } catch (e) {
                    console.log('Nota: Não foi possível atualizar site_type no Supabase', e);
                }

                return NextResponse.json({ 
                    success: true, 
                    message: 'WordPress instalado com sucesso',
                    domain,
                    url: wpUrl,
                    adminUrl: `${wpUrl}/wp-admin`
                });
            }

            case 'getWPInfo': {
                const { domain } = body;

                if (!domain) {
                    return NextResponse.json({ error: 'Domínio é obrigatório' }, { status: 400 });
                }

                const checkScript = `
                if [ -f "/home/${domain}/public_html/wp-config.php" ]; then
                    echo "WP_FOUND"
                    # Extract version
                    cd "/home/${domain}/public_html"
                    if command -v wp &> /dev/null; then
                        WP_VERSION=$(wp core version --allow-root 2>/dev/null || echo "Unknown")
                        echo "VERSION:$WP_VERSION"
                    fi
                else
                    echo "WP_NOT_FOUND"
                fi
                `;

                const result = await executeCyberPanelCommand(checkScript);
                const installed = result.includes('WP_FOUND');
                const versionMatch = result.match(/VERSION:(.+)/);
                const version = versionMatch ? versionMatch[1].trim() : 'Unknown';

                return NextResponse.json({
                    success: true,
                    installed,
                    info: {
                        software: 'WordPress',
                        version,
                        path: `/home/${domain}/public_html`,
                        url: `https://${domain}`,
                        databaseName: `${domain}_wp`,
                        databaseUser: `usr_${domain}`
                    }
                });
            }

            case 'backupWordPress': {
                const { domain, includeDirectory = true, includeDatabase = true } = body;

                if (!domain) {
                    return NextResponse.json({ error: 'Domínio é obrigatório' }, { status: 400 });
                }

                const backupScript = `
                BACKUP_DIR="/home/${domain}/backup/wordpress"
                TIMESTAMP=$(date +%Y%m%d_%H%M%S)
                BACKUP_FILE="wp-backup-$TIMESTAMP.tar.gz"
                
                # Create backup directory
                mkdir -p "$BACKUP_DIR"
                
                # Backup files
                if [ "${includeDirectory}" = "true" ]; then
                    tar -czf "$BACKUP_DIR/$BACKUP_FILE" -C "/home/${domain}" public_html 2>&1
                fi
                
                # Backup database
                if [ "${includeDatabase}" = "true" ]; then
                    if [ -f "/home/${domain}/public_html/wp-config.php" ]; then
                        DB_NAME=$(grep "DB_NAME" "/home/${domain}/public_html/wp-config.php" | cut -d "'" -f 4)
                        DB_USER=$(grep "DB_USER" "/home/${domain}/public_html/wp-config.php" | cut -d "'" -f 4)
                        DB_PASS=$(grep "DB_PASSWORD" "/home/${domain}/public_html/wp-config.php" | cut -d "'" -f 4)
                        
                        if [ ! -z "$DB_NAME" ] && [ ! -z "$DB_USER" ]; then
                            mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_DIR/db-backup-$TIMESTAMP.sql" 2>&1
                            tar -czf "$BACKUP_DIR/wp-backup-$TIMESTAMP-full.tar.gz" -C "$BACKUP_DIR" "$BACKUP_FILE" "db-backup-$TIMESTAMP.sql" 2>/dev/null
                            rm "$BACKUP_DIR/$BACKUP_FILE" "$BACKUP_DIR/db-backup-$TIMESTAMP.sql" 2>/dev/null
                            BACKUP_FILE="wp-backup-$TIMESTAMP-full.tar.gz"
                        fi
                    fi
                fi
                
                echo "SUCCESS:$BACKUP_FILE:$BACKUP_DIR"
                `;

                const result = await executeCyberPanelCommand(backupScript);

                if (result.includes('SUCCESS:')) {
                    const parts = result.split('SUCCESS:')[1].trim().split(':');
                    const filename = parts[0] || '';
                    const path = parts[1] || '';

                    return NextResponse.json({
                        success: true,
                        message: 'Backup criado com sucesso',
                        backup: {
                            filename,
                            path,
                            date: new Date().toISOString(),
                            size: 'Unknown'
                        }
                    });
                } else {
                    return NextResponse.json({ error: 'Falha ao criar backup', details: result }, { status: 400 });
                }
            }

            case 'getWPBackups': {
                const { domain } = body;

                if (!domain) {
                    return NextResponse.json({ error: 'Domínio é obrigatório' }, { status: 400 });
                }

                const listScript = `
                BACKUP_DIR="/home/${domain}/backup/wordpress"
                if [ -d "$BACKUP_DIR" ]; then
                    ls -la "$BACKUP_DIR"/*.tar.gz 2>/dev/null | while read line; do
                        filename=$(echo "$line" | awk '{print $9}')
                        size=$(echo "$line" | awk '{print $5}')
                        date=$(echo "$line" | awk '{print $6, $7, $8}')
                        echo "FILE:$filename:$size:$date"
                    done
                else
                    echo "NO_BACKUPS"
                fi
                `;

                const result = await executeCyberPanelCommand(listScript);

                if (result.includes('NO_BACKUPS')) {
                    return NextResponse.json({ success: true, backups: [] });
                }

                const backups = result.split('\n')
                    .filter(line => line.startsWith('FILE:'))
                    .map(line => {
                        const parts = line.split(':');
                        return {
                            id: parts[1] || '',
                            filename: parts[1] ? parts[1].split('/').pop() : '',
                            size: parts[2] || 'Unknown',
                            date: parts[3] || 'Unknown'
                        };
                    });

                return NextResponse.json({ success: true, backups });
            }

            case 'deleteWPBackup': {
                const { domain, backupId } = body;

                if (!domain || !backupId) {
                    return NextResponse.json({ error: 'Domínio e ID do backup são obrigatórios' }, { status: 400 });
                }

                const deleteScript = `
                BACKUP_FILE="${backupId}"
                if [ -f "$BACKUP_FILE" ]; then
                    rm "$BACKUP_FILE"
                    echo "SUCCESS"
                else
                    echo "NOT_FOUND"
                fi
                `;

                const result = await executeCyberPanelCommand(deleteScript);

                if (result.includes('SUCCESS')) {
                    return NextResponse.json({ success: true, message: 'Backup eliminado com sucesso' });
                } else {
                    return NextResponse.json({ error: 'Backup não encontrado' }, { status: 404 });
                }
            }

            default:
                return NextResponse.json({ error: 'Action não suportado' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('[WP API Exception]', error?.message || error);
        return NextResponse.json(
            {
                error: 'Erro na API WordPress',
                details: error instanceof Error ? error.message : 'Erro desconhecido'
            },
            { status: 500 }
        );
    }
}

