// Menu Admin › Gestão de contas (Silva, 20/10/2026): ordem fixa, sem "Adicionar cliente" à cabeça (o botão "+ Adicionar
// cliente" das listas já lá leva), Revendedores e Profissionais a seguir a "Os meus clientes", e "Sites das contas" em
// penúltimo. Vários módulos acrescentam itens a este grupo em tempo de execução, por isso a função é idempotente e cada um
// chama-a depois de mexer no menu.
import { DESC, EN, MENU } from './generated/data';

/** páginas que existem mas não aparecem na barra lateral */
export const SEM_MENU = new Set(['novo-cliente']);

const ORDEM = [
  'utilizadores',
  'meus-clientes',
  'revendedores',
  'profissionais',
  'pacotes',
  'mover',
  'modelos-mensagem',
  'senhas',
  'pacotes-revenda',
  'administradores',
  'sites-contas',
  'ligados',
];

export function arrumarMenuContas() {
  const grupo = MENU.admin.find(([g]) => g === 'Gestão de contas');
  if (!grupo) return;
  const itens = grupo[1];
  if (!itens.some((it) => it.id === 'profissionais')) {
    itens.push({
      id: 'profissionais',
      fa: 'fa-id-badge',
      t: 'Profissionais',
      c: 'c2',
      da: '—',
      f: ['Lista das contas de profissional (com site)', 'Pacote, disco e tráfego de cada uma', 'Suspender, reativar, apagar, enviar mensagem'],
      hx: { s: 'app', cmd: '', n: 'Lista das contas do servidor com o tipo Profissional' },
    });
  }
  DESC['admin/profissionais'] = ['Contas de profissional (com site): pacote, disco e tráfego', 'Professional accounts (with a site): package, disk and traffic'];
  if (!('Profissionais' in EN)) EN['Profissionais'] = 'Professionals';
  const pos = (id: string) => ORDEM.indexOf(id);
  itens.sort((a, b) => pos(a.id) - pos(b.id)); // os que não estão na lista (pos -1) ficam à cabeça, escondidos ou não
}
