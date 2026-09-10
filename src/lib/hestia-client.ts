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
    throw new Error('Credenciais HestiaCP ausentes. Configure HESTIA_HOST e HESTIA_PASSWORD.');
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
async function hestiaCallViaSsh(cmd: string, args: string[]): Promise<HestiaCallResult> {
  const { executeServerCommand } = await import('@/lib/server-ssh-exec');
  const quoted = args.map((a) => `'${a.replace(/'/g, `'\\''`)}'`).join(' ');
  try {
    const output = (await executeServerCommand(`/usr/local/hestia/bin/${cmd} ${quoted} 2>&1`)).trim();
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
      error: e instanceof Error ? e.message : 'Ligação SSH ao Hestia falhou',
    };
  }
}

export async function hestiaCall(cmd: string, args: string[] = []): Promise<HestiaCallResult> {
  const { host, port, user, password } = resolveHestiaConfig();

  const body = new URLSearchParams();
  body.set('user', user);
  body.set('password', password);
  body.set('cmd', cmd);
  args.forEach((value, i) => body.set(`arg${i + 1}`, value));

  let response: Response;
  try {
    response = await fetch(`https://${host}:${port}/api/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store',
    });
  } catch (e: unknown) {
    return hestiaCallViaSsh(cmd, args);
  }

  const output = (await response.text()).trim();
  const exitCodeHeader = response.headers.get('hestia-exit-code');
  const exitCode = exitCodeHeader !== null ? Number(exitCodeHeader) : response.ok ? 0 : 1;

  if (exitCode !== 0) {
    if (/ip is not allowed/i.test(output)) {
      return hestiaCallViaSsh(cmd, args);
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
    return { ok: false, error: 'Resposta inválida do Hestia' };
  }
}
