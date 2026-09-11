/**
 * SSO phpMyAdmin para o painel Hestia/Contabo: o utilizador já autenticado
 * no painel entra no MySQL sem segundo login.
 */

import crypto from 'crypto';
import { executeServerCommand } from '@/lib/server-ssh-exec';
import { getPhpMyAdminUrl } from '@/lib/server-config';
import { listSiteMysqlSchemas } from '@/lib/hestia-mysql-acl';

const TICKET_DIR = '/var/lib/phpmyadmin/sso';
const KEY_FILE = '/etc/phpmyadmin/vd-panel-sso.key';

function mysqlQuote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

async function mysqlRoot(sql: string): Promise<string> {
  const b64 = Buffer.from(sql, 'utf8').toString('base64');
  const marker = '__MYSQL_OK__';
  const out = await executeServerCommand(
    `echo '${b64}' | base64 -d | mysql --batch --raw --skip-column-names --default-character-set=utf8mb4 && echo ${marker}`,
  );
  if (!out.includes(marker) || /ERROR\s+\d+/i.test(out)) {
    throw new Error(out.replace(marker, '').trim() || 'MySQL falhou a criar o acesso temporário.');
  }
  return out.replace(marker, '').trim();
}

async function createTempMysqlLogin(
  _owner: string,
  database?: string,
): Promise<{ user: string; password: string; host: string }> {
  const user = `pma_vd_${crypto.randomBytes(6).toString('hex')}`;
  const password = crypto.randomBytes(18).toString('base64url');
  const schemas = await listSiteMysqlSchemas().catch(() => [] as string[]);
  const focus = database && /^[A-Za-z0-9_]+$/.test(database) ? database : '';
  const grantDbs = focus ? [focus] : schemas;
  const grants = grantDbs.length
    ? grantDbs.map((db) => `GRANT ALL PRIVILEGES ON \`${db}\`.* TO \`${user}\`@\`localhost\``)
    : [];
  if (!grants.length) {
    throw new Error('Não há bases de dados de sites para abrir no MySQL.');
  }
  await mysqlRoot(
    [
      `CREATE USER \`${user}\`@\`localhost\` IDENTIFIED BY ${mysqlQuote(password)}`,
      ...grants,
      'FLUSH PRIVILEGES',
    ].join('; '),
  );
  return { user, password, host: 'localhost' };
}

async function readSsoSecret(): Promise<string> {
  const raw = (await executeServerCommand(`test -s ${KEY_FILE} && cat ${KEY_FILE}`)).trim();
  if (!raw) throw new Error('Chave SSO do phpMyAdmin em falta no servidor.');
  return raw;
}

export async function createPhpMyAdminSsoUrl(
  owner: string,
  database?: string,
): Promise<string> {
  const secret = await readSsoSecret();
  const login = await createTempMysqlLogin(owner, database);
  const nonce = crypto.randomBytes(16).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + 90;
  const mac = crypto.createHmac('sha256', secret).update(`${nonce}|${exp}`).digest('hex');
  const ticket = JSON.stringify({
    user: login.user,
    password: login.password,
    host: login.host,
    db: database && /^[A-Za-z0-9_]+$/.test(database) ? database : '',
  });
  const b64 = Buffer.from(ticket, 'utf8').toString('base64');
  const ticketPath = `${TICKET_DIR}/${nonce}.json`;
  await executeServerCommand(
    `mkdir -p ${TICKET_DIR} && echo '${b64}' | base64 -d > ${ticketPath} && chmod 644 ${ticketPath} && (chown root:www-data ${ticketPath} || chown root:hestiamail ${ticketPath} || true)`,
  );
  const qs = new URLSearchParams({ n: nonce, exp: String(exp), mac });
  return `${getPhpMyAdminUrl().replace(/\/?$/, '/')}vd-panel-sso.php?${qs.toString()}`;
}
