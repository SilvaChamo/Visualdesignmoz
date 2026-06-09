/** Mensagens claras para utilizadores (sem jargão técnico). */

export function googleOAuthUserMessage(error?: string | null, description?: string | null): {
  title: string;
  desc: string;
} {
  const code = (error || '').toLowerCase();
  const detail = (description || '').toLowerCase();

  if (code === 'access_denied' || detail.includes('request canceled') || detail.includes('cancel')) {
    return {
      title: 'Login com Google cancelado',
      desc:
        'O processo foi interrompido no Google (cancelou ou fechou a janela). ' +
        'Tente novamente e conclua a verificação até ao fim. ' +
        'Isto não significa que a conta não existe.',
    };
  }

  if (
    code === 'callback_error' ||
    detail.includes('invalid_client') ||
    detail.includes('redirect_uri') ||
    detail.includes('malformed') ||
    detail.includes('401')
  ) {
    return {
      title: 'Login com Google temporariamente indisponível',
      desc:
        'A ligação Google ↔ servidor de autenticação não está correcta (configuração OAuth). ' +
        'Não é porque a sua conta não existe. ' +
        'Use email e password, ou contacte o suporte. ' +
        'Quando o Google estiver activo, a conta é criada automaticamente na primeira entrada bem-sucedida.',
    };
  }

  return {
    title: 'Não foi possível entrar com Google',
    desc:
      description ||
      'Erro ao concluir o login com Google. Pode usar email e password. ' +
      'Na primeira entrada com Google bem-sucedida, a conta é criada automaticamente.',
  };
}

export const REGISTER_EMAIL_FAIL_HINT =
  'O servidor de email de confirmação não está configurado. ' +
  'A conta pode ser criada mesmo assim — tente entrar com email e password. ' +
  'Se não funcionar, peça ao administrador para activar o registo sem confirmação de email.';

export const LOGIN_NO_ACCOUNT_HINT =
  'Se ainda não tem conta, use «Criar conta». Com Google, a conta nasce sozinha após concluir o login no Google (não precisa registar antes).';
