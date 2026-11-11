import { EMAIL_PLANS, getEmailCyclePrice, type EmailPlanDef } from '@/lib/email-plans';
import { INTEGRACAO_CSS, INTEGRACAO_JS } from './integracao';
import { MODELO_BASE, MODELO_IMPORTADOS } from './modelo';

export type PastaVhostmail = 'inbox' | 'sent';

export interface OpcoesVhostmail {
  /** endereço da caixa aberta (ex.: admin@visualdesignmoz.com) */
  conta: string;
  pasta: PastaVhostmail;
  tema: 'light' | 'dark';
  /** pacote da conta no servidor (ex.: VD-Email-Basico), só para dizer qual é o plano actual */
  plano: string;
  /** o administrador recebe os e-mails reais importados do maquete; os outros, só mensagens de exemplo */
  admin: boolean;
}

const milhares = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function itensDoPlano(p: EmailPlanDef): string[] {
  return [
    p.accounts === null ? 'Contas de e-mail ilimitadas' : p.accounts + ' contas de e-mail',
    p.storageGb + ' GB de armazenamento',
    '1 domínio de e-mail',
    'POP3 / IMAP / SMTP',
    'Anti-spam avançado',
    'Suporte 24h',
  ];
}

/** Os planos de e-mail que existem (Básico, Premium e Enterprise), com o preço anual de /precos/email */
export function planosParaVhostmail(planoActual: string) {
  const atual = EMAIL_PLANS.find((p) => p.hestiaPackage.toLowerCase() === planoActual.toLowerCase());
  return {
    planos: EMAIL_PLANS.map((p) => ({
      id: p.id,
      nome: p.label,
      preco: milhares(getEmailCyclePrice(p, 'annual')) + ' MT',
      ciclo: '/ano',
      itens: itensDoPlano(p),
      popular: p.popular,
      actual: atual?.id === p.id,
    })),
    planoTxt: atual ? atual.label : planoActual || 'Incluído no seu plano',
  };
}

/** JSON seguro para pôr dentro de um <script> */
const jsonSeguro = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** A página do VhostMail (o maquete aprovado) já com a conta, a pasta, o tema e os planos reais */
export function montarVhostmail(o: OpcoesVhostmail): string {
  const { planos, planoTxt } = planosParaVhostmail(o.plano);
  const cfg = {
    conta: o.conta,
    pasta: o.pasta,
    tema: o.tema,
    planos,
    planoTxt,
    exemplo: !o.admin,
  };
  const comCfg = MODELO_BASE.replace('</style></head>', () => INTEGRACAO_CSS + '</style></head>').replace('/*__VM_CFG__*/', () => 'window.VM_CFG=' + jsonSeguro(cfg) + ';');
  return comCfg + (o.admin ? MODELO_IMPORTADOS : '') + '\n' + INTEGRACAO_JS + '</script></body></html>';
}
