import { NextResponse } from 'next/server';
import { Client } from 'ssh2';

async function execSSH(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = '';
    const rawKey = process.env.SSH_PRIVATE_KEY || '';
    
    if (!rawKey.includes('BEGIN') || !rawKey.includes('END')) {
      return reject(new Error('SSH_PRIVATE_KEY inválida'));
    }
    
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const host = process.env.CYBERPANEL_IP || '109.199.104.22';

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('SSH timeout'));
    }, 30000);

    conn.on('ready', () => {
      clearTimeout(timeout);
      conn.exec(command, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        stream.on('data', (d: Buffer) => { out += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
        stream.on('close', () => { conn.end(); resolve(out); });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    
    conn.connect({
      host, port: 22, username: 'root',
      privateKey: Buffer.from(privateKey),
      readyTimeout: 15000,
      keepaliveInterval: 5000,
      keepaliveCountMax: 3,
    });
  });
}

export async function GET() {
  const result: any = {
    timestamp: new Date().toISOString(),
    server: process.env.CYBERPANEL_IP || '109.199.104.22',
    tests: {}
  };

  try {
    // 1. Verificar status do Postfix (systemd + fallback para processo/porta)
    result.tests.postfixStatus = await execSSH('systemctl status postfix --no-pager 2>&1 | head -30');
    result.tests.postfixRunning = result.tests.postfixStatus.includes('active (running)');
    
    // Fallback: verificar se processo master está rodando ou porta 25 está aberta
    if (!result.tests.postfixRunning) {
      const processCheck = await execSSH('ps aux | grep "postfix/sbin/master" | grep -v grep | head -1');
      const portCheck = await execSSH('ss -tlnp | grep :25 | grep master | head -1');
      result.tests.postfixRunning = !!(processCheck || portCheck);
      if (result.tests.postfixRunning) {
        result.tests.postfixStatus += '\n(Postfix detectado via processo/porta - rodando fora do systemd)';
      }
    }

    // 2. Verificar fila de emails (mailq)
    result.tests.mailQueue = await execSSH('mailq 2>&1 | head -50');
    result.tests.queueCount = await execSSH('mailq 2>&1 | tail -1');

    // 3. Verificar logs recentes do Postfix
    result.tests.recentLogs = await execSSH('tail -50 /var/log/maillog 2>/dev/null || tail -50 /var/log/mail.log 2>/dev/null || echo "Log file not found"');

    // 3.1 Logs detalhados do journalctl para Postfix
    result.tests.postfixJournal = await execSSH('journalctl -xeu postfix.service --no-pager -n 30 2>&1 || echo "journalctl not available"');

    // 4. Verificar se a porta 25 está aberta
    result.tests.port25 = await execSSH('netstat -tlnp 2>/dev/null | grep :25 || ss -tlnp | grep :25 || echo "Port 25 check failed"');

    // 5. Verificar configuração do Postfix
    result.tests.postfixConfig = await execSSH('postconf -n 2>&1 | grep -E "(myhostname|mydomain|inet_interfaces|mydestination|relayhost)" | head -10');

    // 5.1 Verificar configuração completa do main.cf
    result.tests.mainCf = await execSSH('cat /etc/postfix/main.cf 2>&1 | head -50');

    // 5.2 Verificar erros na configuração do Postfix
    result.tests.postfixCheck = await execSSH('postfix check 2>&1 || echo "postfix check failed"');

    // 6. Verificar status do Dovecot (IMAP/POP3)
    result.tests.dovecotStatus = await execSSH('systemctl status dovecot --no-pager 2>&1 | head -10');
    result.tests.dovecotRunning = result.tests.dovecotStatus.includes('active (running)');

    // 7. Verificar contas de email no vmail
    result.tests.emailAccounts = await execSSH('mysql vmail -e "SELECT COUNT(*) as total FROM users;" -B -N 2>/dev/null || echo "0"');

    // 8. Testar resolução DNS MX
    result.tests.mxRecords = await execSSH('host -t MX visualdesign.store 2>&1 || echo "DNS lookup failed"');

    // 9. Verificar SPF e DKIM
    result.tests.spfRecord = await execSSH('host -t TXT visualdesign.store 2>&1 | grep "v=spf1" || echo "SPF not found"');

    // 10. Verificar se o IP está em blacklists (básico)
    result.tests.ipInfo = await execSSH('curl -s ipinfo.io/ip 2>/dev/null || echo "IP check failed"');

    // 11. Verificar permissões do diretório de fila
    result.tests.queuePermissions = await execSSH('ls -la /var/spool/postfix/ 2>&1 | head -10');

    // 12. Verificar processos em execução
    result.tests.processes = await execSSH('ps aux | grep postfix 2>&1 | head -10');

    result.success = true;
  } catch (error: any) {
    result.success = false;
    result.error = error.message;
  }

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  try {
    const { action, to, from, subject, body, service } = await req.json();
    
    if (action === 'sendTest') {
      // Enviar email de teste via comando mail ou sendmail
      const emailContent = `To: ${to}
From: ${from}
Subject: ${subject}
Content-Type: text/plain; charset=UTF-8

${body}
`;
      
      // Usar sendmail para enviar
      const command = `echo '${emailContent.replace(/'/g, "'\"'\"'")}' | sendmail -i ${to} 2>&1`;
      const output = await execSSH(command);
      
      return NextResponse.json({
        success: !output.includes('error'),
        output,
        message: 'Comando sendmail executado'
      });
    }
    
    if (action === 'flushQueue') {
      // Forçar reenvio da fila
      const output = await execSSH('postqueue -f 2>&1 && echo "Queue flushed"');
      return NextResponse.json({ success: true, output });
    }
    
    if (action === 'deleteQueue') {
      // Limpar fila de emails
      const output = await execSSH('postsuper -d ALL 2>&1');
      return NextResponse.json({ success: true, output });
    }

    // Controle de serviços
    if (action === 'serviceStart' && service) {
      const output = await execSSH(`systemctl start ${service} 2>&1 && echo "Serviço ${service} iniciado"`);
      return NextResponse.json({ success: !output.includes('error'), output });
    }

    if (action === 'serviceStop' && service) {
      const output = await execSSH(`systemctl stop ${service} 2>&1 && echo "Serviço ${service} parado"`);
      return NextResponse.json({ success: !output.includes('error'), output });
    }

    if (action === 'serviceRestart' && service) {
      const output = await execSSH(`systemctl restart ${service} 2>&1 && echo "Serviço ${service} reiniciado"`);
      return NextResponse.json({ success: !output.includes('error'), output });
    }

    if (action === 'serviceStatus' && service) {
      const output = await execSSH(`systemctl status ${service} --no-pager 2>&1 | head -30`);
      const running = output.includes('active (running)');
      return NextResponse.json({ success: true, output, running });
    }

    // Ações de manutenção avançada
    if (action === 'killProcesses') {
      // Matar todos os processos postfix travados
      const output = await execSSH(`
        pkill -9 postfix 2>&1 || true
        pkill -9 master 2>&1 || true
        sleep 1
        ps aux | grep postfix | grep -v grep || echo "Nenhum processo postfix encontrado"
      `);
      return NextResponse.json({ success: true, output });
    }

    if (action === 'cleanLocks') {
      // Limpar lock files e pid
      const output = await execSSH(`
        rm -f /var/lib/postfix/master.lock 2>&1 || true
        rm -f /var/spool/postfix/pid/master.pid 2>&1 || true
        rm -f /var/run/postfix/*.pid 2>&1 || true
        echo "Lock files removidos"
        ls -la /var/lib/postfix/master.lock 2>&1 || echo "master.lock: não existe (OK)"
        ls -la /var/spool/postfix/pid/master.pid 2>&1 || echo "master.pid: não existe (OK)"
      `);
      return NextResponse.json({ success: true, output });
    }

    if (action === 'resetPostfix') {
      // Reset completo: parar, limpar, iniciar
      const output = await execSSH(`
        systemctl stop postfix 2>&1 || true
        pkill -9 postfix 2>&1 || true
        pkill -9 master 2>&1 || true
        rm -f /var/lib/postfix/master.lock 2>&1 || true
        rm -f /var/spool/postfix/pid/master.pid 2>&1 || true
        sleep 2
        systemctl start postfix 2>&1
        sleep 2
        systemctl status postfix --no-pager 2>&1 | head -5
      `);
      const success = output.includes('active (running)') || output.includes('started');
      return NextResponse.json({ success, output });
    }

    if (action === 'fixPermissions') {
      // Corrigir permissões do postfix
      const output = await execSSH(`
        postfix set-permissions 2>&1 || true
        chown -R postfix:postfix /var/spool/postfix 2>&1 || true
        chown -R postfix:postfix /var/lib/postfix 2>&1 || true
        echo "Permissões corrigidas"
      `);
      return NextResponse.json({ success: true, output });
    }

    if (action === 'checkConfig') {
      // Verificar configuração do postfix
      const output = await execSSH(`postfix check 2>&1`);
      const hasErrors = output.includes('error') || output.includes('fatal');
      return NextResponse.json({ success: !hasErrors, output });
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
