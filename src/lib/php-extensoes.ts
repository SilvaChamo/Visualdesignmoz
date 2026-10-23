// Catálogo das extensões PHP que o painel mostra em Definições PHP › Extensões (Silva, 23/10/2026): as que o WordPress e os outros sistemas
// costumam pedir e muitas mais, por categorias. Usado pela página (src/components/vhost/paginas/dominios.tsx) e pela rota
// /api/vhost/php-extensoes, por isso não importa nada do navegador nem do servidor.

export interface ExtensaoPhp {
  /** nome do módulo como aparece em `php -m` (em minúsculas) */
  k: string;
  nome: string;
  /** para que serve, numa frase */
  desc: string;
  /** sufixo do pacote do Debian/Ubuntu (php8.3-<pkg>); 'common' = já vem com o PHP; null = faz parte do próprio PHP */
  pkg: string | null;
  /** a categoria em que aparece na página */
  cat: string;
  /** o site deixa de funcionar sem ela: nunca se desativa */
  essencial?: boolean;
}

export const EXTENSOES_PHP: ExtensaoPhp[] = [
  { k: 'mysqli', nome: 'MySQLi', desc: 'Liga os sites à base de dados MySQL/MariaDB', pkg: 'mysql', cat: 'Base de dados', essencial: true },
  { k: 'json', nome: 'JSON', desc: 'Lê e escreve dados em JSON (APIs, temas e plugins)', pkg: null, cat: 'XML e dados', essencial: true },
  { k: 'curl', nome: 'cURL', desc: 'Pedidos a outros sites: actualizações, pagamentos, APIs', pkg: 'curl', cat: 'Rede e comunicação', essencial: true },
  { k: 'mbstring', nome: 'Multibyte String', desc: 'Texto com acentos e outros alfabetos (UTF-8)', pkg: 'mbstring', cat: 'Texto e idiomas', essencial: true },
  { k: 'openssl', nome: 'OpenSSL', desc: 'Ligações seguras (HTTPS) e cifra de dados', pkg: null, cat: 'Segurança e cálculo', essencial: true },
  { k: 'xml', nome: 'XML', desc: 'Lê e escreve XML (feeds, mapas do site, importações)', pkg: 'xml', cat: 'XML e dados', essencial: true },
  { k: 'dom', nome: 'DOM', desc: 'Percorre e altera páginas HTML e XML', pkg: 'xml' , cat: 'XML e dados'},
  { k: 'simplexml', nome: 'SimpleXML', desc: 'Lê XML de forma simples', pkg: 'xml' , cat: 'XML e dados'},
  { k: 'zip', nome: 'Zip', desc: 'Instala temas e plugins e cria cópias de segurança em .zip', pkg: 'zip' , cat: 'Imagens e ficheiros'},
  { k: 'gd', nome: 'GD', desc: 'Cria e redimensiona imagens (miniaturas)', pkg: 'gd' , cat: 'Imagens e ficheiros'},
  { k: 'imagick', nome: 'ImageMagick', desc: 'Imagens de melhor qualidade, WebP e PDF', pkg: 'imagick' , cat: 'Imagens e ficheiros'},
  { k: 'intl', nome: 'Intl', desc: 'Datas, números e textos em várias línguas', pkg: 'intl' , cat: 'Texto e idiomas'},
  { k: 'exif', nome: 'EXIF', desc: 'Lê a informação das fotografias (rotação, data)', pkg: 'common' , cat: 'Imagens e ficheiros'},
  { k: 'fileinfo', nome: 'Fileinfo', desc: 'Descobre o tipo verdadeiro de um ficheiro enviado', pkg: 'common' , cat: 'Imagens e ficheiros'},
  { k: 'sodium', nome: 'Sodium', desc: 'Cifra moderna (palavras-passe e chaves)', pkg: 'common' , cat: 'Segurança e cálculo'},
  { k: 'bcmath', nome: 'BCMath', desc: 'Contas com números muito grandes ou com muitas casas decimais', pkg: 'bcmath' , cat: 'Segurança e cálculo'},
  { k: 'opcache', nome: 'OPcache', desc: 'Guarda o código já lido: o site abre bem mais depressa', pkg: 'opcache' , cat: 'Cache e desempenho'},
  { k: 'iconv', nome: 'Iconv', desc: 'Converte texto entre codificações', pkg: 'common' , cat: 'Texto e idiomas'},
  { k: 'ctype', nome: 'Ctype', desc: 'Verifica se um texto tem só letras, números…', pkg: 'common', cat: 'Texto e idiomas', essencial: true },
  { k: 'zlib', nome: 'Zlib', desc: 'Compressão (gzip) das páginas e dos ficheiros', pkg: null, cat: 'Imagens e ficheiros', essencial: true },
  { k: 'pdo_mysql', nome: 'PDO MySQL', desc: 'Outra forma de falar com o MySQL (Laravel, Joomla, Drupal…)', pkg: 'mysql' , cat: 'Base de dados'},
  { k: 'soap', nome: 'SOAP', desc: 'Serviços web SOAP (transportadoras, bancos, facturação)', pkg: 'soap' , cat: 'XML e dados'},
  { k: 'gmp', nome: 'GMP', desc: 'Matemática com números enormes (criptografia, pagamentos)', pkg: 'gmp' , cat: 'Segurança e cálculo'},
  { k: 'sqlite3', nome: 'SQLite3', desc: 'Base de dados num só ficheiro', pkg: 'sqlite3' , cat: 'Base de dados'},
  { k: 'pdo_sqlite', nome: 'PDO SQLite', desc: 'SQLite através do PDO', pkg: 'sqlite3' , cat: 'Base de dados'},
  { k: 'pgsql', nome: 'PostgreSQL', desc: 'Liga a bases de dados PostgreSQL', pkg: 'pgsql' , cat: 'Base de dados'},
  { k: 'pdo_pgsql', nome: 'PDO PostgreSQL', desc: 'PostgreSQL através do PDO', pkg: 'pgsql' , cat: 'Base de dados'},
  { k: 'redis', nome: 'Redis', desc: 'Cache de objectos e sessões em Redis (sites rápidos e lojas)', pkg: 'redis' , cat: 'Cache e desempenho'},
  { k: 'memcached', nome: 'Memcached', desc: 'Cache de objectos em memória', pkg: 'memcached' , cat: 'Cache e desempenho'},
  { k: 'apcu', nome: 'APCu', desc: 'Cache simples em memória, dentro do PHP', pkg: 'apcu' , cat: 'Cache e desempenho'},
  { k: 'ldap', nome: 'LDAP', desc: 'Entrar com contas de um directório da empresa', pkg: 'ldap' , cat: 'Rede e comunicação'},
  { k: 'imap', nome: 'IMAP', desc: 'Ler e-mails de uma caixa de correio a partir do site', pkg: 'imap' , cat: 'Rede e comunicação'},
  { k: 'bz2', nome: 'Bzip2', desc: 'Ficheiros comprimidos em .bz2', pkg: 'bz2' , cat: 'Imagens e ficheiros'},
  { k: 'ftp', nome: 'FTP', desc: 'Liga a servidores FTP', pkg: 'common' , cat: 'Rede e comunicação'},
  { k: 'sockets', nome: 'Sockets', desc: 'Ligações de rede de baixo nível', pkg: 'common' , cat: 'Rede e comunicação'},
  { k: 'tidy', nome: 'Tidy', desc: 'Limpa e corrige HTML', pkg: 'tidy' , cat: 'XML e dados'},
  { k: 'xsl', nome: 'XSL', desc: 'Transforma XML com folhas de estilo XSLT', pkg: 'xsl' , cat: 'XML e dados'},
  { k: 'readline', nome: 'Readline', desc: 'Linha de comandos do PHP (tarefas agendadas e ferramentas)', pkg: 'readline' , cat: 'Desenvolvimento'},
  { k: 'yaml', nome: 'YAML', desc: 'Lê e escreve ficheiros YAML', pkg: 'yaml' , cat: 'XML e dados'},
  { k: 'mongodb', nome: 'MongoDB', desc: 'Liga a bases de dados MongoDB', pkg: 'mongodb' , cat: 'Base de dados'},
  { k: 'igbinary', nome: 'igbinary', desc: 'Guarda dados mais pequenos na cache (com Redis ou Memcached)', pkg: 'igbinary' , cat: 'XML e dados'},
  { k: 'msgpack', nome: 'MessagePack', desc: 'Formato de dados compacto, mais leve que o JSON', pkg: 'msgpack' , cat: 'XML e dados'},
  { k: 'uuid', nome: 'UUID', desc: 'Cria identificadores únicos', pkg: 'uuid' , cat: 'Desenvolvimento'},
  { k: 'gettext', nome: 'Gettext', desc: 'Traduções de sites e aplicações', pkg: 'common' , cat: 'Texto e idiomas'},
  { k: 'calendar', nome: 'Calendar', desc: 'Contas com calendários (Páscoa, dias da semana)', pkg: 'common' , cat: 'Texto e idiomas'},
  { k: 'snmp', nome: 'SNMP', desc: 'Lê o estado de equipamentos de rede', pkg: 'snmp' , cat: 'Rede e comunicação'},
  { k: 'enchant', nome: 'Enchant', desc: 'Corrector ortográfico', pkg: 'enchant' , cat: 'Texto e idiomas'},
  { k: 'pspell', nome: 'Pspell', desc: 'Corrector ortográfico (Aspell)', pkg: 'pspell' , cat: 'Texto e idiomas'},
  { k: 'amqp', nome: 'AMQP', desc: 'Filas de mensagens RabbitMQ', pkg: 'amqp' , cat: 'Rede e comunicação'},
  { k: 'ssh2', nome: 'SSH2', desc: 'Liga a outros servidores por SSH e SFTP', pkg: 'ssh2' , cat: 'Rede e comunicação'},
  { k: 'xdebug', nome: 'Xdebug', desc: 'Procura erros no código; só para desenvolvimento, nunca num site público', pkg: 'xdebug' , cat: 'Desenvolvimento'},
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

/** As categorias pela ordem em que aparecem na página */
export const CATEGORIAS_PHP = ['Base de dados', 'Imagens e ficheiros', 'Texto e idiomas', 'XML e dados', 'Segurança e cálculo', 'Cache e desempenho', 'Rede e comunicação', 'Desenvolvimento'];
