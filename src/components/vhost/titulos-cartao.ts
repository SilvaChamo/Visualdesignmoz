// Título escrito dentro do cartão principal, por baixo do da barra de cima (Silva, 21/10/2026: "os títulos estão duplicados… escrever de outra
// forma dentro do card… não manter a mesma coisa em todo o painel"). A chave é o título da página; o texto é outra maneira de o dizer.
// Páginas que não estão aqui ficam com o título da própria página.
import { EN } from './generated/data';

const TITULOS: Record<string, [string, string]> = {
  DNS: ['Registos da zona DNS', 'DNS zone records'],
  'Bases de dados': ['Gestão de bases de dados', 'Database management'],
  Utilizadores: ['Utilizadores das bases de dados', 'Database users'],
  phpMyAdmin: ['Abrir as bases de dados', 'Open your databases'],
  'Tarefas cron': ['Tarefas agendadas', 'Scheduled tasks'],
  'Chaves de login': ['Chaves de acesso', 'Access keys'],
  'Chaves SSH': ['Acesso por chaves SSH', 'SSH key access'],
  Git: ['Repositórios do site', 'Site repositories'],
  Reencaminhamentos: ['Reencaminhar mensagens', 'Forward messages'],
  'Respostas automáticas': ['Responder automaticamente', 'Reply automatically'],
  'Mensagens de férias': ['Respostas de ausência', 'Out-of-office replies'],
  'Filtros anti-spam': ['Remetentes bloqueados', 'Blocked senders'],
  'Listas de correio': ['Listas de distribuição', 'Mailing lists'],
  'Registos MX': ['Servidores de e-mail do domínio', 'Mail servers of the domain'],
  'Importar e-mails': ['Trazer e-mails de outro serviço', 'Bring e-mails from another service'],
  'Migração de e-mail': ['Mudar o e-mail para aqui', 'Move your e-mail here'],
  Webmail: ['Aceder ao correio', 'Open your mailbox'],
  'Força bruta': ['Tentativas bloqueadas', 'Blocked attempts'],
  Redirecionamentos: ['Regras de redirecionamento', 'Redirect rules'],
  'Proteção hotlink': ['Proteja as suas imagens de outros sites', 'Protect your images from other sites'],
  'Definições PHP': ['Versão e ajustes do PHP', 'PHP version and settings'],
  'Extensões PHP': ['Gestão de Módulos PHP', 'PHP modules management'],
  'Gerir WordPress': ['Gestão do site WordPress', 'WordPress site management'],
  'Gerir plugins': ['Gestão de plugins', 'Plugin management'],
  'Gerir páginas': ['Gestor de páginas WordPress', 'WordPress page manager'],
  'Gerir utilizadores': ['Gestor de utilizadores WordPress', 'WordPress user manager'],
  'Pacotes de cliente': ['Pacotes e limites', 'Packages and limits'],
  Revendedores: ['Gestão de revendedores', 'Reseller management'],
  'Pacotes de revenda': ['Pacotes e limites das revendas', 'Reseller packages and limits'],
  Suporte: ['Pedidos de ajuda', 'Help requests'],
  Facturação: ['Contas e pagamentos', 'Accounts and payments'],
  Encomendas: ['Encomendas dos clientes', 'Customer orders'],
  Firewall: ['Regras do servidor', 'Server rules'],
  Atualizações: ['Atualizações do servidor', 'Server updates'],
  'Certificado do painel': ['Segurança do painel', 'Panel security'],
  'Multi-servidor': ['Servidores ligados', 'Linked servers'],
  Backups: ['Cópias de todas as contas', 'Copies of every account'],
  'Backup do sistema': ['Cópia do servidor', 'Server copy'],
  'ModSecurity (WAF)': ['Proteção do servidor', 'Server protection'],
  'Estatísticas do servidor': ['Uso do servidor', 'Server usage'],
  Tickets: ['Pedidos recebidos', 'Requests received'],
  'Mensagem a todos': ['Aviso aos clientes', 'Notice to customers'],
};
for (const [pt, en] of Object.values(TITULOS)) if (!(pt in EN)) EN[pt] = en;

/** O título de dentro do cartão para a página com este título (o da barra de cima) */
export function tituloDoCartao(tituloPagina: string): string {
  return TITULOS[tituloPagina]?.[0] ?? tituloPagina;
}
