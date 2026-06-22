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
    code === 'request_timeout' ||
    detail.includes('request_timeout') ||
    detail.includes('timed out') ||
    detail.includes('504')
  ) {
    return {
      title: 'Login com Google demorou demasiado',
      desc:
        'O servidor de autenticação não conseguiu contactar o Google a tempo. ' +
        'Isto costuma ser temporário — tente de novo em 1 minuto. ' +
        'Se persistir, use email e password.',
    };
  }

  if (
    detail.includes('code verifier') ||
    detail.includes('pkce') ||
    detail.includes('both auth code and code verifier') ||
    detail.includes('invalid flow state')
  ) {
    return {
      title: 'Não foi possível concluir o login',
      desc:
        'Clique outra vez em «Entrar com Google» e conclua o passo no Google. ' +
        'Se continuar, use email e password — a conta é criada na primeira entrada bem-sucedida.',
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
        'Não foi possível concluir o login após o Google (erro no callback). ' +
        'Tente de novo em 1 minuto ou use email e password. ' +
        'Na primeira entrada bem-sucedida, a conta é criada automaticamente.',
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
