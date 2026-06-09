import { getServerHost } from '@/lib/server-config';
import { executeServerCommand } from '@/lib/server-ssh-exec';

const SCRIPT = '/usr/local/sbin/apply-brevo-mx-bind.sh';

export async function applyBrevoMxToDomain(domain: string): Promise<{ ok: boolean; output: string }> {
  const d = domain.trim().toLowerCase();
  if (!d || !d.includes('.')) {
    return { ok: false, output: 'Domínio inválido' };
  }
  try {
    const output = await executeServerCommand(
      `bash ${SCRIPT} ${JSON.stringify(d).slice(1, -1)} 2>&1`,
    );
    const ok = output.includes('OK:') || output.includes('DNS Brevo MX aplicado');
    return { ok, output: output.trim() };
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) };
  }
}

export async function applyBrevoMxToAllDomains(): Promise<{ ok: boolean; output: string }> {
  try {
    const output = await executeServerCommand(`bash ${SCRIPT} 2>&1`);
    return { ok: true, output: output.trim() };
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) };
  }
}

export async function injectInboundEmail(input: {
  to: string;
  from: string;
  subject?: string;
  body: string;
}): Promise<{ ok: boolean; output: string }> {
  const to = input.to.trim();
  const from = input.from.trim() || '<>';
  const subject = (input.subject || '(sem assunto)').replace(/'/g, "'\\''");
  const bodyB64 = Buffer.from(input.body, 'utf8').toString('base64');
  const cmd = `echo '${bodyB64}' | base64 -d | /usr/local/sbin/brevo-inbound-inject.sh '${to}' '${from}' '${subject}' 2>&1`;
  try {
    const output = await executeServerCommand(cmd);
    const ok = output.includes('injected:');
    return { ok, output: output.trim() };
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) };
  }
}

export function getServerIpForDns(): string {
  return process.env.NEXT_PUBLIC_SERVER_IP?.trim() || getServerHost();
}
