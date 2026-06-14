import { DEFAULT_SERVER_IP } from '@/lib/server-config';
import { VISUALDESIGN_NAMESERVERS } from '@/lib/visualdesign-dns';
import {
  generateOutlookConfigFile,
  generateWelcomeEmailText,
  type EmailAccountInfo,
  type ServerConfig,
} from '@/lib/email-welcome-service';

export function buildEmailServerConfig(domain: string): ServerConfig {
  return {
    ip: DEFAULT_SERVER_IP,
    nameservers: [...VISUALDESIGN_NAMESERVERS],
    package: `vd_${domain}`,
  };
}

export function buildEmailAccountInfo(
  email: string,
  password: string,
  quota = '500 MB',
): EmailAccountInfo {
  const [username, domain] = email.split('@');
  return {
    email,
    password,
    domain: domain || '',
    username: username || email,
    quota,
    contactEmail: 'admin@visualdesignmoz.com',
  };
}

export function buildEmailConfigBundle(email: string, password: string, quotaMb?: number) {
  const quota = quotaMb ? `${quotaMb} MB` : '500 MB';
  const account = buildEmailAccountInfo(email, password, quota);
  const server = buildEmailServerConfig(account.domain);
  const plainText = generateWelcomeEmailText(account, server);
  const outlookFile = generateOutlookConfigFile(account, server);
  return { plainText, outlookFile, shareText: plainText };
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function shareEmailConfigByMail(email: string, shareText: string) {
  const subject = encodeURIComponent(`Configurações de e-mail — ${email}`);
  const body = encodeURIComponent(shareText);
  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');
}
