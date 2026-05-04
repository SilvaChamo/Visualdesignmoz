import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import { getServerHost } from '@/lib/server-config';
import { createClient } from '@/utils/supabase/server';

const adminEmails = ['admin@your-domain.com', 'silva.chamo@gmail.com', 'geral@your-domain.com'];
const HESTIA_BIN = '/usr/local/hestia/bin/';

async function execSSH(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let out = '';
        const rawKey = process.env.SSH_PRIVATE_KEY || '';
        const privateKey = rawKey.includes('-----BEGIN') 
            ? rawKey.replace(/\\n/g, '\n') 
            : rawKey;

        conn.on('ready', () => {
            const fullCommand = command.startsWith('v-') ? `${HESTIA_BIN}${command}` : command;
            conn.exec(fullCommand, (err, stream) => {
                if (err) { conn.end(); return reject(err); }
                stream.on('data', (d: Buffer) => { out += d.toString(); });
                stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
                stream.on('close', () => { conn.end(); resolve(out); });
            });
        });

        conn.on('error', (err) => { 
            console.error('SSH WP ERROR:', err.message);
            reject(err); 
        });

        conn.connect({
            host: process.env.CYBERPANEL_IP || getServerHost(),
            port: parseInt(process.env.CYBERPANEL_SSH_PORT || '22'),
            username: process.env.CYBERPANEL_SSH_USER || 'root',
            privateKey,
            password: process.env.CYBERPANEL_PASS, // Fallback to password
        });
    });
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const userRole = session.user?.user_metadata?.role;
    const isExplicitAdmin = adminEmails.includes(session.user?.email || '');
    if (userRole !== 'admin' && userRole !== 'reseller' && !isExplicitAdmin) {
        return NextResponse.json({ error: 'Acesso restrito.' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { action } = body;

        switch (action) {
            case 'installWordPress': {
                const { 
                    domain, directory, version, siteName, adminUsername, adminPassword, adminEmail,
                    databaseName, databaseUser, databasePassword, plugins
                } = body;
                const user = body.owner || 'admin';

                if (!domain || !siteName || !adminUsername || !adminPassword || !adminEmail) {
                    return NextResponse.json({ error: 'Faltam parâmetros obrigatórios' }, { status: 400 });
                }

                // Hestia Path: /home/{user}/web/{domain}/public_html
                const docRootBase = `/home/${user}/web/${domain}/public_html`;
                const docRoot = directory ? `${docRootBase}/${directory.replace(/^\/+/, '')}` : docRootBase;

                const installScript = `
                echo "--- INICIANDO INSTALAÇÃO HESTIACP + WORDPRESS ---"
                
                # 1. Garantir que o diretório existe
                mkdir -p "${docRoot}"
                cd "${docRoot}"

                # 2. WP-CLI Check
                if ! command -v wp &> /dev/null; then
                    curl -s -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
                    chmod +x wp-cli.phar
                    mv wp-cli.phar /usr/local/bin/wp
                fi

                # 3. Criar Banco de Dados no Hestia
                DB_NAME="${databaseName || domain.replace(/\./g,'_').substring(0,10) + '_wp'}"
                DB_USER="${databaseUser || 'u' + domain.replace(/\./g,'_').substring(0,8)}"
                DB_PASS='${databasePassword || adminPassword}'
                
                echo "Passo 1: Criando base de dados $DB_NAME..."
                ${HESTIA_BIN}v-add-database ${user} "$DB_NAME" "$DB_USER" "$DB_PASS" mysql

                # 4. Download WP
                echo "Passo 2: Descarregando WordPress..."
                wp core download --version="${version || 'latest'}" --allow-root --force --locale=pt_PT

                # 5. Config
                echo "Passo 3: Configurando wp-config.php..."
                # No Hestia, o host do DB é localhost. O nome real do DB no Hestia costuma ser {user}_{dbname}
                REAL_DB="${user}_$DB_NAME"
                REAL_USER="${user}_$DB_USER"
                wp config create --dbname="$REAL_DB" --dbuser="$REAL_USER" --dbpass="$DB_PASS" --allow-root --force

                # 6. Install
                echo "Passo 4: Executando instalação core..."
                wp core install --url="https://${domain}${directory ? '/' + directory : ''}" --title="${siteName}" --admin_user="${adminUsername}" --admin_password="${adminPassword}" --admin_email="${adminEmail}" --allow-root

                # 7. Plugins
                ${plugins?.woocommerce ? `wp plugin install woocommerce --activate --allow-root` : ''}
                ${plugins?.litespeed ? `wp plugin install litespeed-cache --activate --allow-root` : ''}

                # 8. Permissões
                chown -R ${user}:${user} "${docRootBase}"
                find "${docRootBase}" -type f -exec chmod 644 {} \\;
                find "${docRootBase}" -type d -exec chmod 755 {} \\;
                
                echo "--- SUCESSO: WordPress instalado ---"
                `;

                const output = await execSSH(installScript);

                if (output.includes("ERROR") || output.includes("ERRO:")) {
                    return NextResponse.json({ error: 'Falha na instalação', details: output }, { status: 400 });
                }

                return NextResponse.json({ 
                    success: true, 
                    message: 'WordPress instalado com sucesso no HestiaCP',
                    url: `https://${domain}${directory ? '/' + directory : ''}`,
                    output
                });
            }

            case 'getWPInfo': {
                const { domain } = body;
                const user = body.owner || 'admin';
                const path = `/home/${user}/web/${domain}/public_html`;

                const checkScript = `
                if [ -f "${path}/wp-config.php" ]; then
                    echo "WP_FOUND"
                    cd "${path}"
                    VERSION=$(wp core version --allow-root 2>/dev/null || echo "Unknown")
                    echo "VERSION:$VERSION"
                else
                    echo "WP_NOT_FOUND"
                fi
                `;

                const result = await execSSH(checkScript);
                const installed = result.includes('WP_FOUND');
                const version = result.match(/VERSION:(.+)/)?.[1]?.trim() || 'Unknown';

                return NextResponse.json({
                    success: true,
                    installed,
                    info: { software: 'WordPress', version, path, url: `https://${domain}` }
                });
            }

            default:
                return NextResponse.json({ error: 'Ação não suportada' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

