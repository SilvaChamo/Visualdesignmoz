/**
 * Cliente HTTP de baixo nível para a API REST do HestiaCP.
 *
 * Ao contrário do DirectAdmin, o Hestia não exige o proxy SSH (o servidor da
 * app tem IP fixo e não é bloqueado) — chama-se directamente a API pública
 * por HTTPS. Contrato confirmado a ler /usr/local/hestia/web/api/index.php no
 * próprio servidor: POST /api/ com user+password+cmd+arg1..argN devolve, no
 * cabeçalho `Hestia-Exit-Code`, o código de saída real da CLI do Hestia
 * (0 = sucesso) — mais fiável do que tentar interpretar texto de erro.
 */

import { connect } from 'node:net';

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function resolveHestiaConfig(): { host: string; port: string; user: string; password: string } {
  const host = readEnv('HESTIA_HOST');
  const port = readEnv('HESTIA_PORT') || '8083';
  const user = readEnv('HESTIA_USER') || 'vdadmin';
  const password = readEnv('HESTIA_PASSWORD');
  if (!host || !password) {
    throw new Error('Credenciais Vhost ausentes. Configure HESTIA_HOST e HESTIA_PASSWORD.');
  }
  return { host, port, user, password };
}

export type HestiaCallResult = {
  ok: boolean;
  exitCode: number;
  output: string;
  error?: string;
};

/**
 * Invoca um comando `v-*` do Hestia via API. `args` são posicionais (arg1,
 * arg2, ...) — a mesma ordem da própria CLI (`v-add-user USER PASSWORD
 * EMAIL...` → args: [USER, PASSWORD, EMAIL, ...]).
 */
const SSH_EXIT_MARK = '__VD_HESTIA_EXIT__=';

async function hestiaCallViaSsh(cmd: string, args: string[], timeoutMs = 20_000): Promise<HestiaCallResult> {
  const { executeServerCommand } = await import('@/lib/server-ssh-exec');
  const quoted = args.map((a) => `'${a.replace(/'/g, `'\\''`)}'`).join(' ');
  try {
    const raw = (
      await executeServerCommand(`/usr/local/hestia/bin/${cmd} ${quoted} 2>&1; echo "${SSH_EXIT_MARK}$?"`, {
        fast: timeoutMs <= 12_000,
        timeoutMs,
      })
    ).trim();
    // Os v-add-*/v-change-* não escrevem nada quando correm bem — "sem output"
    // não pode ser falha (era assim que um v-add-user bem-sucedido aparecia
    // como "falhou via SSH" e o resto do provisionamento ficava por fazer).
    // O código de saída real é o mesmo contrato do cabeçalho Hestia-Exit-Code.
    const marked = raw.match(new RegExp(`${SSH_EXIT_MARK}(\\d+)\\s*$`));
    if (marked) {
      const exitCode = Number(marked[1]);
      const output = raw.slice(0, marked.index).trim();
      if (exitCode !== 0) {
        return { ok: false, exitCode, output, error: output || `Comando ${cmd} falhou (código ${exitCode})` };
      }
      return { ok: true, exitCode, output };
    }
    const output = raw;
    const denied = /ip is not allowed|access denied|error/i.test(output) && !output.trim().startsWith('{') && !output.trim().startsWith('[');
    if (!output || denied) {
      return { ok: false, exitCode: 1, output, error: output || `Comando ${cmd} falhou via SSH` };
    }
    return { ok: true, exitCode: 0, output };
  } catch (e: unknown) {
    return {
      ok: false,
      exitCode: -1,
      output: '',
      error: e instanceof Error ? e.message : 'Ligação SSH ao Vhost falhou',
    };
  }
}

/** Timeout curto no HTTP: sem isto o login fica preso em SYN_SENT quando o
 * Hestia não está alcançável a partir da rede actual (ex.: Mac fora da VPN). */
const HESTIA_HTTP_TIMEOUT_MS = 5_000;
const HESTIA_SSH_FALLBACK_MS = 12_000;
/** Apagar/criar/mudar contas, pacotes e domínios no Hestia demora (refaz serviços); com 5 s o pedido «falhava» a meio e a conta
 *  ficava por apagar no painel (Silva, 29/10/2026: não conseguia apagar a conta entrecampos). */
const HESTIA_ALTERACAO_TIMEOUT_MS = 120_000;
const ALTERA_O_SERVIDOR = /^v-(add|delete|change|suspend|unsuspend|rebuild|restart|update)-/;

type HestiaCallOptions = {
  timeoutMs?: number;
  sshTimeoutMs?: number;
  sshFallbackOnTransportError?: boolean;
  /** Pede à API o código de saída real no corpo (`returncode=yes`). Obrigatório quando o resultado decide uma entrada. */
  codigoDeSaida?: boolean;
};

export async function hestiaCall(cmd: string, args: string[] = [], options: HestiaCallOptions = {}): Promise<HestiaCallResult> {
  try {
    return await hestiaCallDireto(cmd, args, options);
  } finally {
    // Uma alteração feita pelo site fora do painel (ex.: a conta criada por uma compra): a leitura do servidor que o
    // painel guarda em memória (até 60 min) deixa de valer — senão o cliente novo via "conta não ligada" até ela expirar.
    // Também quando falha: não se sabe se o servidor chegou a mudar.
    if (!cmd.startsWith('v-list-')) void import('@/lib/vhost-servidor').then((m) => m.esquecerLeitura()).catch(() => {});
  }
}

/** A porta da API abre a partir daqui? Em produção sim (o painel corre no próprio servidor); no computador do Silva não: a 8083 só
 *  responde ao servidor. O resultado guarda-se (60 s se não abre, 5 min se abre). */
const alcance = new Map<string, { ok: boolean; ate: number }>();
export async function apiAlcancavel(host: string, port: string, esperaMs = 2_500): Promise<boolean> {
  const k = `${host}:${port}`;
  const guardado = alcance.get(k);
  if (guardado && guardado.ate > Date.now()) return guardado.ok;
  const ok = await new Promise<boolean>((resolve) => {
    const s = connect({ host, port: Number(port) });
    const fim = (r: boolean) => {
      s.destroy();
      resolve(r);
    };
    s.setTimeout(esperaMs, () => fim(false));
    s.once('connect', () => fim(true));
    s.once('error', () => fim(false));
  });
  alcance.set(k, { ok, ate: Date.now() + (ok ? 5 * 60_000 : 60_000) });
  return ok;
}

async function hestiaCallDireto(cmd: string, args: string[], options: HestiaCallOptions): Promise<HestiaCallResult> {
  const { host, port, user, password } = resolveHestiaConfig();
  const demorada = ALTERA_O_SERVIDOR.test(cmd);
  const timeoutMs = options.timeoutMs ?? (demorada ? HESTIA_ALTERACAO_TIMEOUT_MS : HESTIA_HTTP_TIMEOUT_MS);
  const sshMs = options.sshTimeoutMs ?? (demorada ? HESTIA_ALTERACAO_TIMEOUT_MS : HESTIA_SSH_FALLBACK_MS);
  // Sem alcance à API (o painel a correr no computador do Silva): o pedido nem chegaria ao Hestia, por isso é seguro ir já por SSH,
  // também nas alterações. Antes esperava 5 s e desistia com «demorou a responder» (as leituras caíam para SSH, as alterações não).
  if (!(await apiAlcancavel(host, port))) return hestiaCallViaSsh(cmd, args, sshMs);

  const body = new URLSearchParams();
  body.set('user', user);
  body.set('password', password);
  body.set('cmd', cmd);
  if (options.codigoDeSaida) body.set('returncode', 'yes');
  args.forEach((value, i) => body.set(`arg${i + 1}`, value));

  let response: Response;
  try {
    response = await fetch(`https://${host}:${port}/api/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const nomeErro = e instanceof Error ? e.name : '';
    // Leituras (v-list-*) não mudam nada: repetir por SSH é seguro e evita o painel sem dados quando a API tarda.
    // Só as operações que alteram o servidor deixam de se repetir (para não duplicar apagar/emitir SSL).
    if (cmd.startsWith('v-list-')) return hestiaCallViaSsh(cmd, args, sshMs);
    if (nomeErro === 'TimeoutError' || nomeErro === 'AbortError') {
      return {
        ok: false,
        exitCode: -1,
        output: '',
        error: 'O servidor demorou a responder. O pedido pode ainda estar em curso; não foi repetido automaticamente.',
      };
    }
    if (options.sshFallbackOnTransportError === false) {
      return {
        ok: false,
        exitCode: -1,
        output: '',
        error: 'Não foi possível confirmar se o servidor recebeu o pedido; não foi repetido para evitar duplicar a operação.',
      };
    }
    return hestiaCallViaSsh(cmd, args, sshMs);
  }

  const output = (await response.text()).trim();
  const exitCodeHeader = response.headers.get('hestia-exit-code');
  // Com utilizador+password (caminho "legacy" do index.php do Hestia) a API responde SEMPRE 200 e sem o cabeçalho
  // Hestia-Exit-Code, mesmo quando o comando falha (o corpo é só o texto, ex.: "Error: password missmatch"). Daí
  // o 200 valer como sucesso e o v-check-user-password "confirmar" qualquer palavra-passe, até um espaço
  // (Silva, 20/10/2026). Com `returncode=yes` o corpo é o código de saída real; sem isso, um corpo "Error: …" é falha.
  let exitCode: number;
  if (exitCodeHeader !== null) exitCode = Number(exitCodeHeader);
  else if (options.codigoDeSaida) exitCode = /^\d+$/.test(output) ? Number(output) : 1;
  else if (/^error:/i.test(output)) exitCode = 1;
  else exitCode = response.ok ? 0 : 1;

  if (exitCode !== 0) {
    // (com returncode=yes o corpo é só o código; 10 = E_FORBIDDEN, o mesmo "IP is not allowed")
    if (/ip is not allowed/i.test(output) || (options.codigoDeSaida && exitCode === 10)) {
      return hestiaCallViaSsh(cmd, args, sshMs);
    }
    return { ok: false, exitCode, output, error: output || `Comando ${cmd} falhou (código ${exitCode})` };
  }
  return { ok: true, exitCode, output };
}

/** Variante que pede a listagem em JSON (a maioria dos `v-list-*` aceita "json" como último argumento). */
export async function hestiaCallJson<T = unknown>(cmd: string, args: string[] = []): Promise<
  { ok: true; data: T } | { ok: false; error: string }
> {
  const result = await hestiaCall(cmd, [...args, 'json']);
  if (!result.ok) return { ok: false, error: result.error || 'Pedido falhou' };
  try {
    return { ok: true, data: JSON.parse(result.output) as T };
  } catch {
    return { ok: false, error: 'Resposta inválida do Vhost' };
  }
}
