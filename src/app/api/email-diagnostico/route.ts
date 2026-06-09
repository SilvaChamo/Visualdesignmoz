import { NextResponse } from 'next/server';
import { Client } from 'ssh2';
import { getServerHost, getHestiaUrl } from '@/lib/server-config';

async function execSSH(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = '';
    const rawKey = process.env.SSH_PRIVATE_KEY || '';
    
    if (!rawKey.includes('BEGIN') || !rawKey.includes('END')) {
      return reject(new Error('SSH_PRIVATE_KEY inválida'));
    }
    
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const host = process.env.SERVER_IP || getServerHost();

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
    server: process.env.SERVER_IP || getServerHost(),
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
    const { action, to, from, subject, body, service, params } = await req.json();
    
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

    // NOVAS AÇÕES: Correção de problemas específicos
    
    if (action === 'fixSASL') {
      // Corrigir configuração SASL para autenticação funcionar
      const output = await execSSH(`
        # Fazer backup da configuração
        cp /etc/postfix/main.cf /etc/postfix/main.cf.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
        
        # Remover parâmetros não utilizados que causam warnings
        postconf -# mua_client_restrictions 2>/dev/null || true
        postconf -# mua_helo_restrictions 2>/dev/null || true
        postconf -# mua_sender_restrictions 2>/dev/null || true
        postconf -# dovecot_destination_recipient_limit 2>/dev/null || true
        
        # Configurar SASL corretamente
        postconf -e 'smtpd_sasl_auth_enable = yes'
        postconf -e 'smtpd_sasl_type = dovecot'
        postconf -e 'smtpd_sasl_path = private/auth'
        postconf -e 'smtpd_sasl_local_domain ='
        postconf -e 'smtpd_sasl_security_options = noanonymous'
        postconf -e 'broken_sasl_auth_clients = yes'
        
        # Configurar restrições de submission
        postconf -e 'smtpd_client_restrictions = permit_sasl_authenticated,reject'
        postconf -e 'smtpd_helo_restrictions = permit_mynetworks,permit_sasl_authenticated,reject_invalid_helo_hostname,reject_non_fqdn_helo_hostname'
        postconf -e 'smtpd_sender_restrictions = permit_sasl_authenticated,reject_unknown_sender_domain'
        postconf -e 'smtpd_recipient_restrictions = permit_mynetworks,permit_sasl_authenticated,reject_unauth_destination'
        
        # Recarregar Postfix
        postfix reload 2>&1 || postfix start 2>&1
        
        echo "✅ Configuração SASL corrigida"
        echo "Parâmetros removidos: mua_*_restrictions, dovecot_destination_recipient_limit"
        echo "SASL configurado: type=dovecot, path=private/auth"
        postfix check 2>&1 | head -5
      `);
      return NextResponse.json({ success: !output.includes('fatal') && !output.includes('error'), output });
    }

    if (action === 'fixMainCf') {
      // Limpar main.cf removendo parâmetros problemáticos
      const output = await execSSH(`
        # Backup
        cp /etc/postfix/main.cf /etc/postfix/main.cf.clean.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
        
        # Remover linhas problemáticas
        sed -i '/^mua_client_restrictions/d' /etc/postfix/main.cf 2>/dev/null || true
        sed -i '/^mua_helo_restrictions/d' /etc/postfix/main.cf 2>/dev/null || true
        sed -i '/^mua_sender_restrictions/d' /etc/postfix/main.cf 2>/dev/null || true
        sed -i '/^dovecot_destination_recipient_limit/d' /etc/postfix/main.cf 2>/dev/null || true
        
        # Verificar se há erros de configuração
        postfix check 2>&1
        
        echo "✅ main.cf limpo - parâmetros não utilizados removidos"
      `);
      return NextResponse.json({ success: true, output });
    }

    if (action === 'testReceive') {
      // Testar se o servidor está recebendo emails (verificar logs de entrega)
      const output = await execSSH(`
        echo "=== Teste de Recebimento de Email ==="
        echo ""
        echo "1. Verificando logs de entrega recentes:"
        grep -i "delivered\|deliver\|saved\|inbox" /var/log/maillog 2>/dev/null | tail -10 || echo "Nenhum log de entrega encontrado"
        echo ""
        echo "2. Verificando fila de emails:"
        mailq 2>&1 | head -5
        echo ""
        echo "3. Verificando diretório de emails do usuário:"
        ls -la /home/*/Maildir/new/ 2>/dev/null | head -5 || ls -la /var/vmail/*/new/ 2>/dev/null | head -5 || echo "Diretório de emails não encontrado"
        echo ""
        echo "4. Status do serviço de delivery (Dovecot LDA):"
        systemctl status dovecot --no-pager 2>&1 | head -3
      `);
      return NextResponse.json({ success: true, output });
    }

    if (action === 'checkDeliver') {
      // Verificar configuração de entrega local (mailbox_command, LDA)
      const output = await execSSH(`
        echo "=== Configuração de Entrega de Email ==="
        echo ""
        echo "1. Configurações de entrega no Postfix:"
        postconf -n 2>&1 | grep -E "(mailbox_command|home_mailbox|mail_spool_directory|virtual_|dovecot)" | head -15
        echo ""
        echo "2. Configuração do Dovecot LDA:"
        cat /etc/dovecot/conf.d/15-lda.conf 2>/dev/null | grep -v "^#" | grep -v "^$" | head -10 || echo "Arquivo 15-lda.conf não encontrado"
        echo ""
        echo "3. Protocolos do Dovecot:"
        doveconf protocols 2>/dev/null || echo "doveconf não disponível"
        echo ""
        echo "4. Verificar permissões de entrega:"
        ls -la /var/run/dovecot/auth-master 2>/dev/null || ls -la /var/spool/postfix/private/auth 2>/dev/null || echo "Socket de auth não encontrado"
      `);
      return NextResponse.json({ success: true, output });
    }

    if (action === 'checkDomainExists') {
      const domain = params?.domain;
      if (!domain) {
        return NextResponse.json({ error: 'Domínio não especificado' }, { status: 400 });
      }
      
      const output = await execSSH(`
        echo "=== Verificação de Domínio no Servidor ==="
        echo "Domínio: ${domain}"
        echo ""
        
        # Verificar se domínio existe na configuração do Postfix
        echo "1. Verificando domínio no Postfix:"
        postconf -n | grep -i "${domain}" || echo "Domínio não encontrado na configuração do Postfix"
        
        # Verificar se domínio existe no diretório de email
        echo ""
        echo "2. Verificando diretório de email:"
        ls -la /home/*/mail/${domain} 2>/dev/null || ls -la /home/*/mail/${domain} 2>/dev/null || echo "Diretório de email não encontrado"
        
        # Verificar configuração virtual
        echo ""
        echo "3. Verificando tabelas virtuais:"
        postmap -s hash:/etc/postfix/virtual 2>/dev/null | grep "${domain}" || echo "Não encontrado em virtual"
        
        echo ""
        echo "4. Verificando domínio no DirectAdmin:"
        ls -la /usr/local/directadmin/data/users/*/domains.list 2>/dev/null | grep -i "${domain}" || echo "Domínio não listado no DirectAdmin"
        
        # Verificar logs de email recentes para este domínio
        echo ""
        echo "5. Logs recentes para ${domain}:"
        grep "${domain}" /var/log/maillog 2>/dev/null | tail -10 || echo "Nenhum log encontrado"
      `);
      return NextResponse.json({ success: true, output, domain });
    }

    if (action === 'checkEmailDelivery') {
      const domain = params?.domain;
      if (!domain) {
        return NextResponse.json({ error: 'Domínio não especificado' }, { status: 400 });
      }
      
      // Verificar entrega de email para um domínio específico
      const output = await execSSH(`
        echo "=== Diagnóstico de Entrega de Email: ${domain} ==="
        echo ""
        
        # 1. Verificar logs de erro específicos para o domínio
        echo "1. Logs de erro para ${domain}:"
        grep -i "${domain}" /var/log/maillog 2>/dev/null | grep -i "error\\|fail\\|reject\\|bounce\\|deferred" | tail -15 || echo "Nenhum erro encontrado nos logs"
        echo ""
        
        # 2. Verificar fila de emails para o domínio
        echo "2. Emails na fila para ${domain}:"
        mailq 2>/dev/null | grep -A 2 "${domain}" | head -10 || echo "Nenhum email na fila"
        echo ""
        
        # 3. Verificar configuração de transporte
        echo "3. Configuração de transporte no Postfix:"
        postconf -n 2>/dev/null | grep -E "(transport|relay)" | head -5 || echo "Nenhuma configuração especial de transporte"
        echo ""
        
        # 4. Verificar se domínio está em mydestination
        echo "4. Domínios locais (mydestination):"
        postconf mydestination 2>/dev/null || echo "Não foi possível verificar"
        echo ""
        
        # 5. Verificar emails recentes recebidos
        echo "5. Tentativas de entrega recentes:"
        grep "${domain}" /var/log/maillog 2>/dev/null | grep -E "(status=sent|status=bounced|status=deferred)" | tail -10 || echo "Nenhuma tentativa de entrega recente"
        echo ""
        
        # 6. Verificar diretório de email do domínio
        echo "6. Diretório de emails do domínio:"
        find /home -path "*/mail/${domain}/*" -type d 2>/dev/null | head -5 || echo "Diretório não encontrado em /home/*/mail/${domain}"
        find /home -path "*/${domain}/Maildir" -type d 2>/dev/null | head -5 || echo "Maildir não encontrado"
        echo ""
        
        # 7. Verificar permissões
        echo "7. Permissões do diretório de email:"
        ls -la /home/*/mail/${domain} 2>/dev/null | head -3 || echo "Não foi possível verificar permissões"
      `);
      return NextResponse.json({ success: true, output, domain });
    }

    if (action === 'checkEmailReception') {
      const domain = params?.domain || 'visualdesignmoz.com';
      const email = params?.email || `silva.chamo@${domain}`;
      
      const output = await execSSH(`
        echo "=== Diagnóstico de Recebimento de Email ==="
        echo "Domínio: ${domain}"
        echo "Email: ${email}"
        echo ""
        
        # 1. Verificar se domínio está em mydestination
        echo "1. Configuração mydestination:"
        postconf mydestination 2>/dev/null | grep "${domain}" || echo "Domínio NÃO encontrado em mydestination!"
        postconf mydestination 2>/dev/null
        echo ""
        
        # 2. Verificar mailbox_transport
        echo "2. Configuração de entrega local:"
        postconf mailbox_transport 2>/dev/null
        postconf local_transport 2>/dev/null
        postconf virtual_transport 2>/dev/null
        echo ""
        
        # 3. Verificar logs de emails recebidos recentemente
        echo "3. Emails recebidos nas últimas 24h:"
        grep "${domain}" /var/log/maillog 2>/dev/null | grep "from=<" | tail -10 || echo "Nenhum email recebido encontrado nos logs"
        echo ""
        
        # 4. Verificar status de entrega
        echo "4. Status de entrega para ${domain}:"
        grep "${domain}" /var/log/maillog 2>/dev/null | grep -E "(status=|delivered to|saved to)" | tail -10 || echo "Nenhuma entrega encontrada"
        echo ""
        
        # 5. Verificar fila de emails
        echo "5. Emails na fila para ${domain}:"
        mailq 2>/dev/null | grep -A 2 "${domain}" | head -15 || echo "Nenhum email na fila"
        echo ""
        
        # 6. Verificar se conta de email existe
        echo "6. Verificando conta ${email}:"
        LOCALPART=$(echo "${email}" | cut -d'@' -f1)
        echo "Localpart: $LOCALPART"
        
        # Verificar no DirectAdmin
        DA_RESULT=$(grep -r "${email}" /usr/local/directadmin/data/users/*/email 2>/dev/null | head -1)
        if [ -n "$DA_RESULT" ]; then
          echo "✅ Conta encontrada no DirectAdmin"
        else
          echo "❌ Conta não encontrada no DirectAdmin"
        fi
        POSTMAP_RESULT=$(postmap -q "${email}" mysql:/etc/postfix/mysql-virtual_mailboxes.cf 2>/dev/null)
        if [ -n "$POSTMAP_RESULT" ]; then
          echo "✅ Postfix reconhece a conta: $POSTMAP_RESULT"
        else
          echo "❌ Postfix não reconhece a conta"
        fi
        
        # Verificar diretório da conta
        echo "Diretórios encontrados:"
        find /home -type d -name "mail" 2>/dev/null | head -5
        find /home -path "*/${domain}/$LOCALPART*" -type d 2>/dev/null | head -5 || echo "Diretório da conta não encontrado"
        echo ""
        
        # 7. Verificar permissões do diretório de email
        echo "7. Permissões:"
        ls -la /home/*/mail/${domain} 2>/dev/null | head -5 || ls -la /home/*/mail/ 2>/dev/null | head -5 || echo "Não foi possível listar diretórios"
        echo ""
        
        # 8. Testar entrega local
        echo "8. Testando entrega local:"
        echo "Test email" | mail -s "Test $(date)" -r "root@localhost" "${email}" 2>&1 || echo "Comando mail não disponível"
        echo ""
        
        # 9. Verificar se há erro de alias
        echo "9. Verificando aliases:"
        postmap -q "${email}" hash:/etc/postfix/virtual 2>/dev/null || echo "Nenhum alias virtual configurado"
        postalias -q "${email}" 2>/dev/null || echo "Nenhum alias em /etc/aliases"
        echo ""
        
        # 10. Verificar DNS MX do domínio
        echo "10. DNS MX para ${domain}:"
        dig MX ${domain} +short 2>/dev/null || nslookup -type=MX ${domain} 2>/dev/null || echo "Não foi possível consultar MX"
        echo ""
        
        # 11. Verificar IP do servidor
        echo "11. IP do servidor:"
        ip route get 1 2>/dev/null | awk '{print $7; exit}' || hostname -I | awk '{print $1}'
        echo ""
        
        # 12. Verificar portas de email
        echo "12. Portas de email ouvindo:"
        netstat -tlnp 2>/dev/null | grep -E ":25|:587|:993|:995|:110|:143" | head -5 || ss -tlnp | grep -E ":25|:587|:993|:995|:110|:143" | head -5 || echo "Nenhuma porta de email encontrada"
        echo ""
        
        # 13. Verificar firewall
        echo "13. Status do firewall:"
        ufw status 2>/dev/null | head -5 || iptables -L -n 2>/dev/null | head -5 || echo "Não foi possível verificar firewall"
        echo ""
        
        # 14. Verificar SPF do domínio
        echo "14. Registro SPF para ${domain}:"
        dig TXT ${domain} +short 2>/dev/null | grep "v=spf" || echo "Nenhum SPF encontrado"
        echo ""
        
        # 15. Verificar resolução reversa (PTR)
        echo "15. Resolução reversa (PTR):"
        IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')
        dig -x $IP +short 2>/dev/null || echo "Não foi possível consultar PTR"
        echo ""
        
        # 16. Teste de conexão SMTP local
        echo "16. Teste SMTP local na porta 25:"
        timeout 3 bash -c 'echo "QUIT" | nc localhost 25' 2>&1 | head -3 || echo "Não foi possível conectar na porta 25"
        echo ""
        
        # 17. Verificar se IP está em blacklist (via SSH)
        echo "17. Verificação de blacklist (via SSH):"
        IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')
        # 18. Verificar tentativas de conexão externa rejeitadas
        echo "18. Tentativas de conexão externa (últimas 24h):"
        grep "connect from" /var/log/maillog 2>/dev/null | tail -10 || echo "Nenhuma tentativa de conexão externa nos logs"
        echo ""
        
        # 19. Verificar erros de conexão
        echo "19. Erros de conexão SMTP:"
        grep "reject\|refused\|timeout\|Connection refused" /var/log/maillog 2>/dev/null | grep "$(date +%b\\\ %d)" | tail -10 || echo "Nenhum erro de conexão hoje"
        echo ""
        
        # 20. Verificar logs do firewall (se existir)
        echo "20. Logs de firewall (tentativas bloqueadas):"
        grep -i "blocked\|dropped\|denied" /var/log/ufw.log 2>/dev/null | grep "$(date +%Y-%m-%d)" | head -5 || echo "Nenhum log de firewall ou porta 25 não está bloqueada"
        echo ""
        
        echo "=== Fim do diagnóstico ==="
      `);
      return NextResponse.json({ success: true, output, domain, email });
    }

    if (action === 'resetAdminPassword') {
      return NextResponse.json({
        success: false,
        disabled: true,
        output: 'Reset de senha do painel desactivado. Use o DirectAdmin nativo.',
      });
    }


    if (action === 'checkHostingLogin') {
      return NextResponse.json({
        success: false,
        disabled: true,
        output: 'Diagnóstico de login do painel de hospedagem desactivado. Use o DirectAdmin nativo.',
      });
    }

    if (action === 'fixPostfixStartup') {
      // Corrigir problema de startup do Postfix
      const output = await execSSH(`
        echo "=== Corrigindo Postfix Startup ==="
        echo ""
        
        # 1. Remover lock files
        echo "1. Removendo lock files..."
        rm -f /var/lib/postfix/master.lock 2>/dev/null
        rm -f /var/spool/postfix/pid/master.pid 2>/dev/null
        rm -f /var/run/postfix.pid 2>/dev/null
        echo "Lock files removidos"
        echo ""
        
        # 2. Parar todos os processos Postfix
        echo "2. Parando processos Postfix..."
        pkill -9 master 2>/dev/null || echo "Nenhum processo master rodando"
        pkill -9 postfix 2>/dev/null || echo "Nenhum processo postfix rodando"
        sleep 2
        echo "Processos parados"
        echo ""
        
        # 3. Corrigir configuração - remover parâmetros inválidos
        echo "3. Corrigindo main.cf..."
        postconf -e "compatibility_level=3.6" 2>/dev/null || echo "Não foi possível definir compatibility_level"
        
        # Remover parâmetros problemáticos
        postconf -# mua_helo_restrictions 2>/dev/null || echo "mua_helo_restrictions não existe"
        postconf -# mua_sender_restrictions 2>/dev/null || echo "mua_sender_restrictions não existe"
        postconf -# mua_client_restrictions 2>/dev/null || echo "mua_client_restrictions não existe"
        
        # Verificar se há parâmetros inválidos
        postconf -n 2>&1 | grep "unused parameter" || echo "Nenhum parâmetro inválido encontrado"
        echo ""
        
        # 4. Verificar permissões
        echo "4. Corrigindo permissões..."
        chown -R postfix:postfix /var/spool/postfix 2>/dev/null
        chown -R postfix:postfix /var/lib/postfix 2>/dev/null
        echo "Permissões corrigidas"
        echo ""
        
        # 5. Testar configuração
        echo "5. Testando configuração..."
        postfix check 2>&1 || echo "Avisos na configuração"
        echo ""
        
        # 6. Iniciar Postfix
        echo "6. Iniciando Postfix..."
        systemctl stop postfix 2>/dev/null
        sleep 2
        systemctl start postfix 2>&1
        sleep 2
        systemctl status postfix --no-pager 2>/dev/null | head -10
        echo ""
        
        # 7. Verificar se está rodando
        echo "7. Verificando status..."
        ps aux | grep "[p]ostfix" | head -5 || echo "Postfix não está rodando"
        netstat -tlnp | grep :25 || ss -tlnp | grep :25 || echo "Porta 25 não está ouvindo"
        echo ""
        
        echo "=== Correção concluída ==="
      `);
      return NextResponse.json({ success: true, output });
    }

    if (action === 'fixHostingLogin') {
      return NextResponse.json({
        success: false,
        disabled: true,
        output: 'Correcção de login do painel desactivada. Use o DirectAdmin nativo.',
      });
    }

    if (action === 'checkNetwork') {
      const domain = params?.domain || 'visualdesignmoz.com';
      const output = await execSSH(`
        echo "=== Diagnóstico de Rede e Conectividade ==="
        echo ""
        
        # 1. Verificar IP do servidor
        echo "1. IP do servidor:"
        ip addr show | grep "inet " | head -3
        echo ""
        
        # 2. Verificar portas abertas
        echo "2. Portas de email abertas:"
        netstat -tlnp 2>/dev/null | grep -E ":25|:587|:993|:995|:110|:143" || ss -tlnp | grep -E ":25|:587|:993|:995|:110|:143"
        echo ""
        
        # 3. Verificar DNS MX do domínio
        echo "3. Registros MX para ${domain}:"
        dig MX ${domain} +short 2>/dev/null || nslookup -type=MX ${domain} 2>/dev/null | grep "mail exchanger" || echo "Não foi possível consultar MX"
        echo ""
        
        # 4. Verificar DNS A do domínio
        echo "4. Registros A para ${domain}:"
        dig A ${domain} +short 2>/dev/null || nslookup -type=A ${domain} 2>/dev/null | grep "Address:" | tail -3 || echo "Não foi possível consultar A"
        echo ""
        
        # 5. Verificar hostname
        echo "5. Hostname do servidor:"
        hostname
        hostname -f
        echo ""
        
        # 6. Verificar resolução reversa (PTR)
        echo "6. Resolução reversa (PTR):"
        IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')
        echo "IP: $IP"
        dig -x $IP +short 2>/dev/null || echo "Não foi possível consultar PTR"
        echo ""
        
        # 7. Verificar firewall
        echo "7. Status do firewall:"
        ufw status 2>/dev/null || iptables -L -n | head -10 || echo "Não foi possível verificar firewall"
        echo ""
        
        # 8. Teste de conexão SMTP
        echo "8. Teste de conexão SMTP local:"
        echo "QUIT" | nc -v localhost 25 2>&1 | head -5 || telnet localhost 25 2>&1 | head -5 || echo "Não foi possível testar conexão"
        echo ""
        
        # 9. Verificar se IP está em blacklist (simplificado)
        echo "9. Verificação de blacklist (básica):"
        IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')
        echo "IP a verificar: $IP"
        echo "Verificar manualmente em: https://mxtoolbox.com/blacklists.aspx?ip=$IP"
        echo ""
        
        # 10. Verificar SPF do domínio
        echo "10. Registro SPF para ${domain}:"
        dig TXT ${domain} +short 2>/dev/null | grep "v=spf" || echo "Nenhum SPF encontrado"
        echo ""
        
        echo "=== Fim do diagnóstico de rede ==="
      `);
      return NextResponse.json({ success: true, output, domain });
    }

    if (action === 'checkHostingStatus') {
      return NextResponse.json({
        success: false,
        disabled: true,
        output: 'Verificação do painel de hospedagem desactivada. Use o DirectAdmin nativo.',
      });
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

