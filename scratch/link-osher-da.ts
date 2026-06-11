import { readFileSync } from 'fs';
import crypto from 'node:crypto';

function loadEnv() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function strongPassword(): string {
  return `1Yk${crypto.randomBytes(18).toString('base64url')}9RsfX`;
}

async function main() {
  loadEnv();
  const { daRequest } = await import('../src/lib/directadmin');
  const { resolveDirectAdminCredentials } = await import('../src/lib/directadmin-credentials');
  const { provisionResellerAccount } = await import('../src/lib/reseller-provision');
  const { createDirectAdminAPI } = await import('../src/lib/directadmin-adapter');
  const { createClient } = await import('@supabase/supabase-js');

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const email = 'osher@oshercollective.com';
  const daUsername = 'oshercollective';
  const daDomain = 'oshercollective.com';

  const creds = await resolveDirectAdminCredentials('admin');
  const { loadResellerCredentialsByDaUsername } = await import('../src/lib/da-credential-store');
  let password = process.env.OSHER_DA_SYNC_PASSWORD || '';

  const existing = await loadResellerCredentialsByDaUsername(daUsername);
  if (existing?.password) {
    password = existing.password;
    console.log('credentials already stored');
  } else {
    password = password || strongPassword();
    const mod = await daRequest(
      'CMD_API_MODIFY_USER',
      'POST',
      { json: 'yes', action: 'single', user: daUsername, passwd: password, passwd2: password },
      creds,
    );
    if (mod.error) throw new Error(mod.details || mod.text || 'MODIFY_USER failed');
    console.log('DA password set for sync API');
  }

  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 500 });
  let userId = listed.users.find((u) => u.email?.toLowerCase() === email)?.id;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'reseller', nome: 'Osher Collective', da_username: daUsername },
    });
    if (error || !data.user) throw error || new Error('createUser failed');
    userId = data.user.id;
  } else {
    await admin.auth.admin.updateUserById(userId, {
      password,
      user_metadata: { role: 'reseller', nome: 'Osher Collective', da_username: daUsername, da_domain: daDomain },
    });
  }

  await provisionResellerAccount({
    authUserId: userId,
    email,
    password,
    userName: daUsername,
    domain: daDomain,
    linkExisting: true,
    nome: 'Osher Collective',
  });

  const osherApi = createDirectAdminAPI({ role: 'reseller', user: daUsername, password });
  const emails = await osherApi.listEmails('msdnmoz.org');
  const dns = await osherApi.listDNS('msdnmoz.org');
  console.log('verify msdnmoz:', { emails: emails.length, dns: dns.length, userId });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
