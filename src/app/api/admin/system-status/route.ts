import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { requireAdmin } from '@/lib/admin-api-auth';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { getMaintenanceState, setMaintenanceState, type MaintenanceState } from '@/lib/maintenance-state';

export const dynamic = 'force-dynamic';

const execAsync = promisify(exec);

type ProcessInfo = {
  pid?: number;
  user: string;
  cpu: number;
  memory: number;
  name: string;
  type: 'website' | 'app' | 'database' | 'system';
  rawCommand: string;
};

function identifyProcessName(user: string, args: string): { name: string; type: 'website' | 'app' | 'database' | 'system' } {
  // Identificar pools de sites PHP-FPM
  const poolMatch = args.match(/pool\s+([a-z0-9._-]+)/i);
  if (poolMatch && poolMatch[1]) {
    return { name: `Site: ${poolMatch[1]}`, type: 'website' };
  }

  // Identificar aplicações Next.js / Node
  if (args.includes('visualdesign-site-teste')) {
    return { name: 'App: VisualDesign (Site Teste)', type: 'app' };
  }
  if (args.includes('basededadosagro-site-teste')) {
    return { name: 'App: BaseDadosAgro (Site Teste)', type: 'app' };
  }
  if (args.includes('next-server')) {
    return { name: 'App: Next.js Server', type: 'app' };
  }

  // Identificar Base de Dados e Cache
  if (args.includes('mysqld') || args.includes('mariadb')) {
    return { name: 'Base de Dados (MySQL)', type: 'database' };
  }
  if (args.includes('postgres')) {
    return { name: 'Base de Dados (PostgreSQL)', type: 'database' };
  }
  if (args.includes('redis-server')) {
    return { name: 'Cache (Redis)', type: 'database' };
  }

  // Identificar Serviços do Servidor
  if (args.includes('clamscan') || args.includes('maldetect')) {
    return { name: 'Antivírus (ClamAV / MalDetect)', type: 'system' };
  }
  if (args.includes('nginx')) {
    return { name: 'Servidor Web (Nginx)', type: 'system' };
  }
  if (args.includes('apache2') || args.includes('httpd')) {
    return { name: 'Servidor Web (Apache)', type: 'system' };
  }

  // Simplificar comando desconhecido
  const firstWord = args.trim().split(/\s+/)[0] || args;
  const basename = firstWord.split('/').pop() || firstWord;
  return { name: `${basename} (${user})`, type: 'system' };
}

// Recolhe tudo numa só execução no servidor: directamente quando a app corre lá,
// por SSH quando corre no Mac (dev) — os números mostrados são sempre os do
// servidor real, nunca os do computador local. Cada secção começa por "@@nome".
// O top mede durante 1 s e usa-se a 2.ª amostra: o %CPU do ps é a média desde que
// o processo nasceu e dava valores absurdos (200%+) a processos acabados de criar.
const METRICS_SCRIPT = [
  'export LC_ALL=C',
  'echo @@cores; nproc 2>/dev/null',
  'echo @@load; cat /proc/loadavg 2>/dev/null',
  'echo @@uptime; cat /proc/uptime 2>/dev/null',
  "echo @@top; top -b -n 2 -d 1 -c -w 512 -o %CPU 2>/dev/null | awk '/^top -/{f++} f==2' | head -n 30",
  'echo @@free; free -m 2>/dev/null',
  "echo @@zombies; ps -eo state 2>/dev/null | grep -c 'Z'",
  'echo @@db; systemctl is-active mysql 2>/dev/null || systemctl is-active mariadb 2>/dev/null || echo inactive',
  'echo @@nginx; systemctl is-active nginx 2>/dev/null || echo inactive',
  'echo @@redis; systemctl is-active redis 2>/dev/null || systemctl is-active redis-server 2>/dev/null || echo inactive',
  'echo @@end',
].join('; echo; '); // "echo" entre secções: garante que cada marcador começa numa linha nova

function parseSections(output: string): Record<string, string[]> {
  const sections: Record<string, string[]> = {};
  let current = '';
  for (const raw of output.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('@@')) {
      current = line.slice(2);
      if (current === 'end') break;
      sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  return sections;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const sections = parseSections(await executeServerCommand(METRICS_SCRIPT, { fast: true }));
    const first = (key: string) => sections[key]?.[0] ?? '';

    const numCores = parseInt(first('cores'), 10) || 1;
    const loadParts = first('load').split(/\s+/);
    const loadAvg = [0, 1, 2].map((i) => parseFloat(loadParts[i]) || 0); // [1m, 5m, 15m]

    // 2.ª amostra do top: "%Cpu(s): ... 51.1 id, ..." seguido da tabela de processos
    const topLines = sections.top ?? [];
    let cpuUsage = Math.min(100, Math.round(((loadAvg[0] / numCores) * 100) * 10) / 10);
    const idleMatch = topLines.find((l) => l.startsWith('%Cpu'))?.match(/([0-9.]+)\s*id/);
    if (idleMatch && idleMatch[1]) {
      const idle = parseFloat(idleMatch[1]);
      cpuUsage = Math.round((100 - idle) * 10) / 10;
    }

    // RAM (free -m → "Mem: total used free shared buff/cache available")
    let totalMemMb = 0;
    let freeMemMb = 0;
    let usedMemMb = 0;
    let ramUsage = 0;
    const memLine = (sections.free ?? []).find((l) => l.startsWith('Mem:'))?.split(/\s+/) ?? [];
    if (memLine.length >= 7) {
      const total = parseInt(memLine[1], 10);
      const avail = parseInt(memLine[6], 10);
      if (total > 0 && !isNaN(avail)) {
        totalMemMb = total;
        freeMemMb = parseInt(memLine[3], 10) || 0;
        usedMemMb = total - avail;
        ramUsage = Math.round((usedMemMb / total) * 100 * 10) / 10;
      }
    }

    const zombieCount = parseInt(first('zombies'), 10) || 0;

    // Estado dos Serviços do Servidor ("mysql || mariadb" pode escrever duas linhas)
    const serviceStatus = (key: string) => ((sections[key] ?? []).includes('active') ? 'active' : 'inactive');
    const dbStatus = serviceStatus('db');
    const nginxStatus = serviceStatus('nginx');
    const redisStatus = serviceStatus('redis');

    // Processos de Maior Consumo (Identifica que site ou serviço está a consumir CPU / RAM)
    // Colunas do top: PID USER PR NI VIRT RES SHR S %CPU %MEM TIME+ COMMAND
    const topProcesses: ProcessInfo[] = [];
    const headerIdx = topLines.findIndex((l) => l.startsWith('PID '));
    for (const line of headerIdx >= 0 ? topLines.slice(headerIdx + 1) : []) {
      const parts = line.split(/\s+/);
      if (parts.length < 12) continue;

      const pid = parseInt(parts[0], 10);
      const user = parts[1];
      // O %CPU do top é relativo a 1 núcleo — dividir pelos núcleos para ficar na
      // mesma escala do "CPU Global" (100% = servidor inteiro)
      const cpu = Math.round((parseFloat(parts[8]) / numCores) * 10) / 10;
      const memory = parseFloat(parts[9]);
      const args = parts.slice(11).join(' ');
      if (isNaN(cpu)) continue;

      // Ignorar o próprio script de recolha (shell com os marcadores, top, awk, head)
      if (args.includes('@@') || /^(top|awk|head) /.test(args)) continue;

      const identified = identifyProcessName(user, args);

      topProcesses.push({
        pid: !isNaN(pid) ? pid : undefined,
        user,
        cpu,
        memory,
        name: identified.name,
        type: identified.type,
        rawCommand: args.substring(0, 100),
      });
    }

    // Identificar o Maior Consumidor no momento (Top Consumer)
    const topConsumer = topProcesses.length > 0 ? topProcesses[0] : null;

    // Status do CPU
    let cpuStatus: 'normal' | 'warning' | 'critical' = 'normal';
    if (cpuUsage >= 85) {
      cpuStatus = 'critical';
    } else if (cpuUsage >= 65) {
      cpuStatus = 'warning';
    }

    const maintenance = getMaintenanceState();

    return NextResponse.json({
      cpu: {
        usage: cpuUsage,
        cores: numCores,
        status: cpuStatus,
      },
      memory: {
        totalMb: totalMemMb,
        usedMb: usedMemMb,
        freeMb: freeMemMb,
        usage: ramUsage,
      },
      services: {
        database: dbStatus,
        nginx: nginxStatus,
        redis: redisStatus,
      },
      topConsumer,
      topProcesses: topProcesses.slice(0, 8),
      load: loadAvg.map((l) => Math.round(l * 100) / 100),
      zombies: zombieCount,
      uptime: Math.round(parseFloat(first('uptime')) || 0),
      maintenance,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Erro ao obter estado do sistema:', error);
    return NextResponse.json({ error: 'Erro ao obter métricas do sistema' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const body = await req.json();
    const { action, active, message, pid } = body;

    // No Mac (dev local) estas acções atingiriam o próprio computador (ex: fechar o Chrome)
    if (process.platform === 'darwin' && action !== 'toggle_maintenance') {
      return NextResponse.json({ error: 'Acção desactivada no computador local — só funciona no servidor.' }, { status: 400 });
    }

    if (action === 'toggle_maintenance') {
      const currentState = getMaintenanceState();
      const newState: MaintenanceState = {
        active: active !== undefined ? Boolean(active) : !currentState.active,
        message: message || currentState.message || 'Servidor em manutenção temporária.',
        updatedAt: new Date().toISOString(),
      };
      setMaintenanceState(newState);
      return NextResponse.json({ success: true, maintenance: newState });
    }

    if (action === 'restart_mysql') {
      try {
        await execAsync('systemctl restart mysql 2>/dev/null || systemctl restart mariadb 2>/dev/null');
        return NextResponse.json({ success: true, message: 'Serviço da Base de Dados (MySQL) reiniciado.' });
      } catch (err: any) {
        return NextResponse.json({ error: `Erro ao reiniciar MySQL: ${err.message}` }, { status: 500 });
      }
    }

    if (action === 'kill_process' && pid) {
      const numericPid = parseInt(pid, 10);
      if (isNaN(numericPid) || numericPid <= 10 || numericPid === process.pid) {
        return NextResponse.json({ error: 'PID inválido ou protegido do sistema.' }, { status: 400 });
      }
      // Confirmar no próprio servidor quem é o processo — nunca confiar no que o browser
      // envia. Só se terminam processos de utilizadores normais (uid >= 1000, ex: pools
      // PHP dos sites). Ficam protegidos: root e serviços do sistema; bases de dados
      // (reconhecidas pelo comando — o Postgres do Supabase aparece no host com outro
      // utilizador); tudo o que corre em contentores (a stack Supabase, incluindo o
      // "auth" do login, corre com uid 1000); e o próprio painel Hestia.
      let uid = NaN;
      let cmdline = '';
      let cgroup = '';
      try {
        const status = fs.readFileSync(`/proc/${numericPid}/status`, 'utf8');
        uid = parseInt(status.match(/^Uid:\s+(\d+)/m)?.[1] ?? '', 10);
        cmdline = fs.readFileSync(`/proc/${numericPid}/cmdline`, 'utf8').replace(/\0/g, ' ').trim();
        cgroup = fs.readFileSync(`/proc/${numericPid}/cgroup`, 'utf8');
      } catch {
        return NextResponse.json({ error: `O processo PID ${numericPid} já não existe.` }, { status: 404 });
      }
      if (
        isNaN(uid) ||
        uid < 1000 ||
        identifyProcessName('', cmdline).type === 'database' ||
        /docker|containerd|hestia\.service/.test(cgroup)
      ) {
        return NextResponse.json(
          { error: 'Este processo pertence ao sistema ou à base de dados e não pode ser terminado a partir do painel.' },
          { status: 403 },
        );
      }
      try {
        process.kill(numericPid, 'SIGKILL');
        return NextResponse.json({ success: true, message: `Processo PID ${numericPid} terminado com sucesso.` });
      } catch (err: any) {
        return NextResponse.json({ error: `Erro ao terminar processo PID ${numericPid}: ${err.message}` }, { status: 500 });
      }
    }

    if (action === 'reboot_server') {
      try {
        setTimeout(() => {
          exec('shutdown -r now || reboot', (err) => {
            if (err) console.error('Erro ao reiniciar:', err);
          });
        }, 3000);

        return NextResponse.json({ success: true, message: 'Servidor vai reiniciar dentro de 3 segundos.' });
      } catch (err: any) {
        return NextResponse.json({ error: `Erro ao agendar reboot: ${err.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error: any) {
    console.error('Erro na ação de sistema:', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar requisição' }, { status: 500 });
  }
}
