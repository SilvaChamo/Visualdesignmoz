import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

// SSH Connection
async function execSSH(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = '';
    const rawKey = process.env.SSH_PRIVATE_KEY || '';
    
    if (!rawKey.includes('BEGIN') || !rawKey.includes('END')) {
      return reject(new Error('SSH_PRIVATE_KEY inválida'));
    }
    
    const privateKey = rawKey.replace(/\\n/g, '\n');

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('SSH timeout'));
    }, 30000);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          conn.end();
          return reject(err);
        }
        
        stream.on('data', (data: Buffer) => {
          out += data.toString();
        });
        
        stream.on('close', (code: number) => {
          clearTimeout(timeout);
          conn.end();
          resolve(out);
        });
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    }).connect({
      host: process.env.SSH_HOST || getServerHost(),
      port: 22,
      username: process.env.SSH_USER || 'root',
      privateKey: privateKey
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    switch (action) {
      case 'checkStatus': {
        // Verificar status dos serviços
        const opendkimStatus = await execSSH('systemctl is-active opendkim 2>/dev/null || echo "inactive"');
        const postfixStatus = await execSSH('systemctl is-active postfix 2>/dev/null || echo "inactive"');
        const crontabCheck = await execSSH('crontab -l 2>/dev/null | grep watchdog | wc -l');
        
        return NextResponse.json({
          success: true,
          services: {
            opendkim: opendkimStatus.trim(),
            postfix: postfixStatus.trim(),
            watchdogInstalled: parseInt(crontabCheck.trim()) > 0
          }
        });
      }

      case 'installWatchdog': {
        // Criar script watchdog unificado
        const watchdogScript = `#!/bin/bash
# Watchdog unificado para OpenDKIM e Postfix
LOG_FILE="/var/log/watchdog.log"

# Verificar OpenDKIM
if ! pgrep -x "opendkim" > /dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S'): OpenDKIM parado, reiniciando..." >> $LOG_FILE
    systemctl restart opendkim 2>&1 >> $LOG_FILE
    if [ $? -eq 0 ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S'): OpenDKIM reiniciado com sucesso" >> $LOG_FILE
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S'): ERRO ao reiniciar OpenDKIM" >> $LOG_FILE
    fi
fi

# Verificar Postfix
if ! pgrep -x "master" > /dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S'): Postfix parado, reiniciando..." >> $LOG_FILE
    systemctl restart postfix 2>&1 >> $LOG_FILE
    if [ $? -eq 0 ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S'): Postfix reiniciado com sucesso" >> $LOG_FILE
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S'): ERRO ao reiniciar Postfix" >> $LOG_FILE
    fi
fi

# Verificar se os serviços estão healthy
if ! systemctl is-active --quiet opendkim; then
    echo "$(date '+%Y-%m-%d %H:%M:%S'): OpenDKIM não está healthy, tentando reiniciar..." >> $LOG_FILE
    systemctl restart opendkim 2>&1 >> $LOG_FILE
fi

if ! systemctl is-active --quiet postfix; then
    echo "$(date '+%Y-%m-%d %H:%M:%S'): Postfix não está healthy, tentando reiniciar..." >> $LOG_FILE
    systemctl restart postfix 2>&1 >> $LOG_FILE
fi`;

        // Salvar script
        await execSSH(`cat > /usr/local/bin/email-watchdog.sh << 'EOF'
${watchdogScript}
EOF`);
        
        // Tornar executável
        await execSSH('chmod +x /usr/local/bin/email-watchdog.sh');
        
        // Criar log file
        await execSSH('touch /var/log/watchdog.log && chmod 644 /var/log/watchdog.log');
        
        // Adicionar ao crontab (a cada 2 minutos para resposta rápida)
        await execSSH(`(crontab -l 2>/dev/null | grep -v "email-watchdog"; echo "*/2 * * * * /usr/local/bin/email-watchdog.sh >/dev/null 2>&1") | crontab -`);
        
        return NextResponse.json({
          success: true,
          message: 'Watchdog instalado com sucesso! Verificação a cada 2 minutos.'
        });
      }

      case 'restartServices': {
        // Reiniciar serviços manualmente
        const results = {
          opendkim: { success: false, output: '' },
          postfix: { success: false, output: '' }
        };
        
        try {
          results.opendkim.output = await execSSH('systemctl restart opendkim 2>&1 && echo "OpenDKIM reiniciado com sucesso"');
          results.opendkim.success = true;
        } catch (err: any) {
          results.opendkim.output = err.message;
        }
        
        try {
          results.postfix.output = await execSSH('systemctl restart postfix 2>&1 && echo "Postfix reiniciado com sucesso"');
          results.postfix.success = true;
        } catch (err: any) {
          results.postfix.output = err.message;
        }
        
        return NextResponse.json({
          success: results.opendkim.success && results.postfix.success,
          results
        });
      }

      case 'getLogs': {
        // Obter últimas 50 linhas do log
        const logs = await execSSH('tail -n 50 /var/log/watchdog.log 2>/dev/null || echo "Log não encontrado"');
        return NextResponse.json({
          success: true,
          logs: logs.trim()
        });
      }

      case 'removeWatchdog': {
        // Remover do crontab
        await execSSH('crontab -l 2>/dev/null | grep -v "email-watchdog" | crontab -');
        // Remover script
        await execSSH('rm -f /usr/local/bin/email-watchdog.sh');
        
        return NextResponse.json({
          success: true,
          message: 'Watchdog removido com sucesso'
        });
      }

      default:
        return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Watchdog API Error]:', error);
    return NextResponse.json(
      { error: 'Erro interno', message: error.message },
      { status: 500 }
    );
  }
}
