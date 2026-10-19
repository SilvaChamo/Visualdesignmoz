import { getRedirectPathForRole, type UserRole } from '@/lib/user-roles';

/** Texto de acesso ao painel para partilhar/descarregar — sem dependências server-only (seguro em componentes cliente). */
export function buildPanelAccessConfigText(params: {
  email: string;
  password: string;
  panelRole: UserRole | string;
  name?: string | null;
  origin?: string;
}): { plainText: string; outlookFile: string; shareText: string } {
  const origin = params.origin || 'https://visualdesignmoz.com';
  const panelPath = getRedirectPathForRole(
    (params.panelRole as UserRole) || 'client',
  );
  const plainText = `
ACESSO AO PAINEL
================

Nome: ${params.name || params.email.split('@')[0]}
Email: ${params.email}
Palavra-passe: ${params.password}
Destino: ${panelPath}
URL de entrada: ${origin}/login

Guarde estas credenciais em local seguro.
`.trim();

  return {
    plainText,
    outlookFile: plainText,
    shareText: plainText,
  };
}
