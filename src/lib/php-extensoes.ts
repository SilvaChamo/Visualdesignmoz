// Catálogo das extensões PHP que o painel mostra em Definições PHP › Extensões (Silva, 23/10/2026): as que o WordPress exige ou recomenda
// e muitas outras que os sites costumam pedir. Usado pela página (src/components/vhost/paginas/dominios.tsx) e pela rota
// /api/vhost/php-extensoes, por isso não importa nada do navegador nem do servidor.

export type NivelExtensao = 'exigida' | 'recomendada' | 'opcional';

export interface ExtensaoPhp {
  /** nome do módulo como aparece em `php -m` (em minúsculas) */
  k: string;
  nome: string;
  /** para que serve, numa frase */
  desc: string;
  /** sufixo do pacote do Debian/Ubuntu (php8.3-<pkg>); 'common' = já vem com o PHP; null = faz parte do próprio PHP */
  pkg: string | null;
  /** WordPress: exige, recomenda; fora do WordPress é só opcional */
  nivel: NivelExtensao;
  /** o site deixa de funcionar sem ela: nunca se desativa */
  essencial?: boolean;
}

export const EXTENSOES_PHP: ExtensaoPhp[] = [
  // ---- WordPress: exigidas ----
  { k: 'mysqli', nome: 'MySQLi', desc: 'Liga o WordPress à base de dados MySQL/MariaDB', pkg: 'mysql', nivel: 'exigida', essencial: true },
  { k: 'json', nome: 'JSON', desc: 'Lê e escreve dados em JSON (temas, plugins e API do WordPress)', pkg: null, nivel: 'exigida', essencial: true },
  // ---- WordPress: recomendadas ----
  { k: 'curl', nome: 'cURL', desc: 'Pedidos a outros sites: actualizações, pagamentos, APIs', pkg: 'curl', nivel: 'recomendada', essencial: true },
  { k: 'mbstring', nome: 'Multibyte String', desc: 'Texto com acentos e outros alfabetos (UTF-8)', pkg: 'mbstring', nivel: 'recomendada', essencial: true },
  { k: 'openssl', nome: 'OpenSSL', desc: 'Ligações seguras (HTTPS) e cifra de dados', pkg: null, nivel: 'recomendada', essencial: true },
  { k: 'xml', nome: 'XML', desc: 'Lê e escreve XML (feeds, mapas do site, importações)', pkg: 'xml', nivel: 'recomendada', essencial: true },
  { k: 'dom', nome: 'DOM', desc: 'Percorre e altera páginas HTML e XML', pkg: 'xml', nivel: 'recomendada' },
  { k: 'simplexml', nome: 'SimpleXML', desc: 'Lê XML de forma simples', pkg: 'xml', nivel: 'recomendada' },
  { k: 'zip', nome: 'Zip', desc: 'Instala temas e plugins e cria cópias de segurança em .zip', pkg: 'zip', nivel: 'recomendada' },
  { k: 'gd', nome: 'GD', desc: 'Cria e redimensiona imagens (miniaturas)', pkg: 'gd', nivel: 'recomendada' },
  { k: 'imagick', nome: 'ImageMagick', desc: 'Imagens de melhor qualidade, WebP e PDF', pkg: 'imagick', nivel: 'recomendada' },
  { k: 'intl', nome: 'Intl', desc: 'Datas, números e textos em várias línguas', pkg: 'intl', nivel: 'recomendada' },
  { k: 'exif', nome: 'EXIF', desc: 'Lê a informação das fotografias (rotação, data)', pkg: 'common', nivel: 'recomendada' },
  { k: 'fileinfo', nome: 'Fileinfo', desc: 'Descobre o tipo verdadeiro de um ficheiro enviado', pkg: 'common', nivel: 'recomendada' },
  { k: 'sodium', nome: 'Sodium', desc: 'Cifra moderna (palavras-passe e chaves)', pkg: 'common', nivel: 'recomendada' },
  { k: 'bcmath', nome: 'BCMath', desc: 'Contas com números muito grandes ou com muitas casas decimais', pkg: 'bcmath', nivel: 'recomendada' },
  { k: 'opcache', nome: 'OPcache', desc: 'Guarda o código já lido: o site abre bem mais depressa', pkg: 'opcache', nivel: 'recomendada' },
  { k: 'iconv', nome: 'Iconv', desc: 'Converte texto entre codificações', pkg: 'common', nivel: 'recomendada' },
  { k: 'ctype', nome: 'Ctype', desc: 'Verifica se um texto tem só letras, números…', pkg: 'common', nivel: 'recomendada', essencial: true },
  { k: 'zlib', nome: 'Zlib', desc: 'Compressão (gzip) das páginas e dos ficheiros', pkg: null, nivel: 'recomendada', essencial: true },
  // ---- outras muito usadas ----
  { k: 'pdo_mysql', nome: 'PDO MySQL', desc: 'Outra forma de falar com o MySQL (Laravel, Joomla, Drupal…)', pkg: 'mysql', nivel: 'opcional' },
  { k: 'soap', nome: 'SOAP', desc: 'Serviços web SOAP (transportadoras, bancos, facturação)', pkg: 'soap', nivel: 'opcional' },
  { k: 'gmp', nome: 'GMP', desc: 'Matemática com números enormes (criptografia, pagamentos)', pkg: 'gmp', nivel: 'opcional' },
  { k: 'sqlite3', nome: 'SQLite3', desc: 'Base de dados num só ficheiro', pkg: 'sqlite3', nivel: 'opcional' },
  { k: 'pdo_sqlite', nome: 'PDO SQLite', desc: 'SQLite através do PDO', pkg: 'sqlite3', nivel: 'opcional' },
  { k: 'pgsql', nome: 'PostgreSQL', desc: 'Liga a bases de dados PostgreSQL', pkg: 'pgsql', nivel: 'opcional' },
  { k: 'pdo_pgsql', nome: 'PDO PostgreSQL', desc: 'PostgreSQL através do PDO', pkg: 'pgsql', nivel: 'opcional' },
  { k: 'redis', nome: 'Redis', desc: 'Cache de objectos e sessões em Redis (sites rápidos e lojas)', pkg: 'redis', nivel: 'opcional' },
  { k: 'memcached', nome: 'Memcached', desc: 'Cache de objectos em memória', pkg: 'memcached', nivel: 'opcional' },
  { k: 'apcu', nome: 'APCu', desc: 'Cache simples em memória, dentro do PHP', pkg: 'apcu', nivel: 'opcional' },
  { k: 'ldap', nome: 'LDAP', desc: 'Entrar com contas de um directório da empresa', pkg: 'ldap', nivel: 'opcional' },
  { k: 'imap', nome: 'IMAP', desc: 'Ler e-mails de uma caixa de correio a partir do site', pkg: 'imap', nivel: 'opcional' },
  { k: 'bz2', nome: 'Bzip2', desc: 'Ficheiros comprimidos em .bz2', pkg: 'bz2', nivel: 'opcional' },
  { k: 'ftp', nome: 'FTP', desc: 'Liga a servidores FTP', pkg: 'common', nivel: 'opcional' },
  { k: 'sockets', nome: 'Sockets', desc: 'Ligações de rede de baixo nível', pkg: 'common', nivel: 'opcional' },
  { k: 'tidy', nome: 'Tidy', desc: 'Limpa e corrige HTML', pkg: 'tidy', nivel: 'opcional' },
  { k: 'xsl', nome: 'XSL', desc: 'Transforma XML com folhas de estilo XSLT', pkg: 'xsl', nivel: 'opcional' },
  { k: 'readline', nome: 'Readline', desc: 'Linha de comandos do PHP (tarefas agendadas e ferramentas)', pkg: 'readline', nivel: 'opcional' },
  { k: 'yaml', nome: 'YAML', desc: 'Lê e escreve ficheiros YAML', pkg: 'yaml', nivel: 'opcional' },
  { k: 'mongodb', nome: 'MongoDB', desc: 'Liga a bases de dados MongoDB', pkg: 'mongodb', nivel: 'opcional' },
  { k: 'igbinary', nome: 'igbinary', desc: 'Guarda dados mais pequenos na cache (com Redis ou Memcached)', pkg: 'igbinary', nivel: 'opcional' },
  { k: 'msgpack', nome: 'MessagePack', desc: 'Formato de dados compacto, mais leve que o JSON', pkg: 'msgpack', nivel: 'opcional' },
  { k: 'uuid', nome: 'UUID', desc: 'Cria identificadores únicos', pkg: 'uuid', nivel: 'opcional' },
  { k: 'gettext', nome: 'Gettext', desc: 'Traduções de sites e aplicações', pkg: 'common', nivel: 'opcional' },
  { k: 'calendar', nome: 'Calendar', desc: 'Contas com calendários (Páscoa, dias da semana)', pkg: 'common', nivel: 'opcional' },
  { k: 'snmp', nome: 'SNMP', desc: 'Lê o estado de equipamentos de rede', pkg: 'snmp', nivel: 'opcional' },
  { k: 'enchant', nome: 'Enchant', desc: 'Corrector ortográfico', pkg: 'enchant', nivel: 'opcional' },
  { k: 'pspell', nome: 'Pspell', desc: 'Corrector ortográfico (Aspell)', pkg: 'pspell', nivel: 'opcional' },
  { k: 'amqp', nome: 'AMQP', desc: 'Filas de mensagens RabbitMQ', pkg: 'amqp', nivel: 'opcional' },
  { k: 'ssh2', nome: 'SSH2', desc: 'Liga a outros servidores por SSH e SFTP', pkg: 'ssh2', nivel: 'opcional' },
  { k: 'xdebug', nome: 'Xdebug', desc: 'Procura erros no código; só para desenvolvimento, nunca num site público', pkg: 'xdebug', nivel: 'opcional' },
];

export type EstadoExtensao = 'ativa' | 'desativada' | 'nao-instalada';

/** O estado de cada extensão, a partir do que o servidor leu: módulos carregados (`php -m`) e pacotes instalados */
export function estadoExtensao(e: ExtensaoPhp, carregadas: string[], pacotes: string[], versao: string): EstadoExtensao {
  const lista = new Set(carregadas.map((m) => m.toLowerCase()));
  // o OPcache aparece como "Zend OPcache"
  const carregada = lista.has(e.k) || (e.k === 'opcache' && lista.has('zend opcache'));
  if (carregada) return 'ativa';
  if (e.pkg === null) return 'nao-instalada';
  return pacotes.includes('php' + versao + '-' + e.pkg) ? 'desativada' : 'nao-instalada';
}
