/** Valores por omissão alinhados com pacotes DirectAdmin (Evolution). */

export type ResellerLimitField =
  | 'bandwidth'
  | 'quota'
  | 'inode'
  | 'vdomains'
  | 'nsubdomains'
  | 'nemails'
  | 'nemailf'
  | 'nemailml'
  | 'nemailr'
  | 'mysql'
  | 'domainptr'
  | 'ftp'
  | 'nusers';

export type ResellerResourceField =
  | 'CPUQuota'
  | 'IOReadBandwidthMax'
  | 'IOReadIOPSMax'
  | 'IOWriteBandwidthMax'
  | 'IOWriteIOPSMax'
  | 'MemoryHigh'
  | 'MemoryMax'
  | 'TasksMax';

export type FeatureSetPolicy = 'all' | 'selected';
export type PluginPolicyMode = 'allow_all' | 'deny_selected' | 'allow_selected';

export type ResellerPackageFormState = {
  packageMode: 'existing' | 'new';
  packageName: string;
  limits: Record<ResellerLimitField, { value: string; unlimited: boolean }>;
  features: {
    ips: string;
    aftp: boolean;
    cgi: boolean;
    git: boolean;
    wordpress: boolean;
    clamav: boolean;
    php: boolean;
    spam: boolean;
    catchall: boolean;
    ssl: boolean;
    ssh: boolean;
    cron: boolean;
    redis: boolean;
    sysinfo: boolean;
    login_keys: boolean;
    dnscontrol: boolean;
    suspend_at_limit: boolean;
    auto_security_txt: boolean;
    jail: boolean;
    oversell: boolean;
    userssh: boolean;
    serverip: boolean;
    dns: 'OFF' | 'TWO' | 'THREE';
  };
  skin: string;
  featureSets: {
    policy: FeatureSetPolicy;
    selected: string[];
  };
  pluginPolicy: {
    mode: PluginPolicyMode;
    allow: string[];
    deny: string[];
  };
  resources: Record<ResellerResourceField, { value: string; unlimited: boolean }>;
};

export const RESELLER_LIMIT_LABELS: Record<ResellerLimitField, string> = {
  bandwidth: 'Tráfego',
  quota: 'Espaço em disco',
  inode: 'N.º de ficheiros (inodes)',
  vdomains: 'Domínios',
  nsubdomains: 'Subdomínios',
  nemails: 'Contas de e-mail',
  nemailf: 'Encaminhamentos de e-mail',
  nemailml: 'Listas de discussão',
  nemailr: 'Respostas automáticas',
  mysql: 'Bases de dados MySQL',
  domainptr: 'Domínios alternativos',
  ftp: 'Contas FTP',
  nusers: 'Contas de utilizadores',
};

export const RESELLER_RESOURCE_LABELS: Record<ResellerResourceField, string> = {
  CPUQuota: 'Cota de CPU',
  IOReadBandwidthMax: 'Largura de banda máx. de leitura I/O',
  IOReadIOPSMax: 'IOPS de leitura máximo',
  IOWriteBandwidthMax: 'Largura de banda máx. de escrita I/O',
  IOWriteIOPSMax: 'IOPS de escrita máximo',
  MemoryHigh: 'Memória alta',
  MemoryMax: 'Memória máxima',
  TasksMax: 'Tarefas máximas',
};

export const FEATURE_SET_OPTIONS: Record<string, string> = {
  core_functions: 'Funções principais',
  dns_only: 'Apenas DNS',
  email_only: 'Apenas e-mail',
};

export function createDefaultResellerPackageForm(packageName = ''): ResellerPackageFormState {
  return {
    packageMode: 'new',
    packageName,
    limits: {
      bandwidth: { value: '1000', unlimited: false },
      quota: { value: '100', unlimited: false },
      inode: { value: '', unlimited: true },
      vdomains: { value: '1', unlimited: false },
      nsubdomains: { value: '10', unlimited: false },
      nemails: { value: '10', unlimited: false },
      nemailf: { value: '0', unlimited: false },
      nemailml: { value: '0', unlimited: false },
      nemailr: { value: '10', unlimited: false },
      mysql: { value: '5', unlimited: false },
      domainptr: { value: '0', unlimited: false },
      ftp: { value: '1', unlimited: false },
      nusers: { value: '', unlimited: true },
    },
    features: {
      ips: '0',
      aftp: false,
      cgi: false,
      git: false,
      wordpress: false,
      clamav: false,
      php: true,
      spam: true,
      catchall: false,
      ssl: true,
      ssh: false,
      cron: true,
      redis: false,
      sysinfo: true,
      login_keys: true,
      dnscontrol: true,
      suspend_at_limit: true,
      auto_security_txt: false,
      jail: true,
      oversell: true,
      userssh: false,
      serverip: true,
      dns: 'OFF',
    },
    skin: 'evolution',
    featureSets: {
      policy: 'all',
      selected: ['core_functions'],
    },
    pluginPolicy: {
      mode: 'allow_all',
      allow: [],
      deny: [],
    },
    resources: {
      CPUQuota: { value: '400%', unlimited: true },
      IOReadBandwidthMax: { value: '5M', unlimited: true },
      IOReadIOPSMax: { value: '1K', unlimited: true },
      IOWriteBandwidthMax: { value: '5M', unlimited: true },
      IOWriteIOPSMax: { value: '1K', unlimited: true },
      MemoryHigh: { value: '1G', unlimited: true },
      MemoryMax: { value: '2G', unlimited: true },
      TasksMax: { value: '512', unlimited: true },
    },
  };
}

function limitToDa(key: ResellerLimitField, row: { value: string; unlimited: boolean }): Record<string, string> {
  if (row.unlimited) {
    if (key === 'bandwidth') return { bandwidth: 'unlimited', ubandwidth: 'ON' };
    if (key === 'quota') return { quota: 'unlimited', uquota: 'ON' };
    return { [key]: 'unlimited' };
  }
  const out: Record<string, string> = { [key]: row.value || '0' };
  if (key === 'bandwidth') out.ubandwidth = 'OFF';
  if (key === 'quota') out.uquota = 'OFF';
  return out;
}

function resourceToDa(key: ResellerResourceField, row: { value: string; unlimited: boolean }): Record<string, string> {
  return { [key]: row.unlimited ? '' : row.value };
}

function boolToDa(key: string, on: boolean): Record<string, string> {
  return { [key]: on ? 'ON' : 'OFF' };
}

function joinDaList(items: string[]): string {
  return items.filter(Boolean).join(':');
}

/** Converte o formulário para campos da API DirectAdmin (pacotes user ou revenda). */
export function hostingPackageFormToDaFields(form: ResellerPackageFormState): Record<string, string> {
  const fields: Record<string, string> = {
    add: 'Save',
    packagename: form.packageName.trim(),
    ips: form.features.ips || '0',
    dns: form.features.dns,
    skin: form.skin || 'evolution',
    feature_sets: form.featureSets.policy === 'all' ? '' : joinDaList(form.featureSets.selected),
  };

  if (form.pluginPolicy.mode === 'allow_selected') {
    fields.plugins_allow = joinDaList(form.pluginPolicy.allow) || '';
    fields.plugins_deny = '[clear]';
  } else if (form.pluginPolicy.mode === 'deny_selected') {
    fields.plugins_deny = joinDaList(form.pluginPolicy.deny) || '';
    fields.plugins_allow = '[clear]';
  } else {
    fields.plugins_allow = '[clear]';
    fields.plugins_deny = '[clear]';
  }

  for (const [key, row] of Object.entries(form.limits) as [ResellerLimitField, { value: string; unlimited: boolean }][]) {
    Object.assign(fields, limitToDa(key, row));
  }

  Object.assign(fields, boolToDa('aftp', form.features.aftp));
  Object.assign(fields, boolToDa('cgi', form.features.cgi));
  Object.assign(fields, boolToDa('git', form.features.git));
  Object.assign(fields, boolToDa('wordpress', form.features.wordpress));
  Object.assign(fields, boolToDa('clamav', form.features.clamav));
  Object.assign(fields, boolToDa('php', form.features.php));
  Object.assign(fields, boolToDa('spam', form.features.spam));
  Object.assign(fields, boolToDa('catchall', form.features.catchall));
  Object.assign(fields, boolToDa('ssl', form.features.ssl));
  Object.assign(fields, boolToDa('ssh', form.features.ssh));
  Object.assign(fields, boolToDa('cron', form.features.cron));
  Object.assign(fields, boolToDa('redis', form.features.redis));
  Object.assign(fields, boolToDa('sysinfo', form.features.sysinfo));
  Object.assign(fields, boolToDa('login_keys', form.features.login_keys));
  Object.assign(fields, boolToDa('dnscontrol', form.features.dnscontrol));
  Object.assign(fields, boolToDa('suspend_at_limit', form.features.suspend_at_limit));
  Object.assign(fields, boolToDa('auto_security_txt', form.features.auto_security_txt));
  Object.assign(fields, boolToDa('jail', form.features.jail));
  Object.assign(fields, boolToDa('userssh', form.features.userssh));
  Object.assign(fields, boolToDa('oversell', form.features.oversell));
  Object.assign(fields, boolToDa('serverip', form.features.serverip));

  for (const [key, row] of Object.entries(form.resources) as [
    ResellerResourceField,
    { value: string; unlimited: boolean },
  ][]) {
    Object.assign(fields, resourceToDa(key, row));
  }

  return fields;
}

/** @deprecated usar hostingPackageFormToDaFields */
export const resellerPackageFormToDaFields = hostingPackageFormToDaFields;

function parseDaBool(val: string | undefined): boolean {
  return val === 'ON' || val === 'yes' || val === '1';
}

function splitDaList(s: string | undefined): string[] {
  if (!s || s === '[clear]') return [];
  return s.split(':').filter(Boolean);
}

function parseDaLimit(
  raw: Record<string, string>,
  key: ResellerLimitField,
  fallback: { value: string; unlimited: boolean },
): { value: string; unlimited: boolean } {
  const val = String(raw[key] ?? '').trim();
  if (key === 'bandwidth' && (val === 'unlimited' || raw.ubandwidth === 'ON')) {
    return { value: '', unlimited: true };
  }
  if (key === 'quota' && (val === 'unlimited' || raw.uquota === 'ON')) {
    return { value: '', unlimited: true };
  }
  if (val === 'unlimited') return { value: '', unlimited: true };
  if (val) return { value: val, unlimited: false };
  return fallback;
}

function parseDaResource(
  raw: Record<string, string>,
  key: ResellerResourceField,
  fallback: { value: string; unlimited: boolean },
): { value: string; unlimited: boolean } {
  const val = String(raw[key] ?? '').trim();
  if (!val) return { ...fallback, unlimited: true };
  return { value: val, unlimited: false };
}

/** Converte campos da API DirectAdmin para o estado do formulário de pacote. */
export function daPackageFieldsToHostingForm(
  raw: Record<string, string>,
  packageName: string,
): ResellerPackageFormState {
  const base = createDefaultResellerPackageForm(packageName);
  const limits = { ...base.limits };
  for (const key of Object.keys(limits) as ResellerLimitField[]) {
    limits[key] = parseDaLimit(raw, key, base.limits[key]);
  }

  const resources = { ...base.resources };
  for (const key of Object.keys(resources) as ResellerResourceField[]) {
    resources[key] = parseDaResource(raw, key, base.resources[key]);
  }

  const featureSetsRaw = String(raw.feature_sets ?? '').trim();
  const pluginsAllow = splitDaList(raw.plugins_allow);
  const pluginsDeny = splitDaList(raw.plugins_deny);
  let pluginMode: PluginPolicyMode = 'allow_all';
  let pluginAllow: string[] = [];
  let pluginDeny: string[] = [];
  if (pluginsDeny.length > 0 && pluginsAllow.length === 0) {
    pluginMode = 'deny_selected';
    pluginDeny = pluginsDeny;
  } else if (pluginsAllow.length > 0) {
    pluginMode = 'allow_selected';
    pluginAllow = pluginsAllow;
  }

  const dnsRaw = String(raw.dns ?? 'OFF').toUpperCase();
  const dns: ResellerPackageFormState['features']['dns'] =
    dnsRaw === 'TWO' || dnsRaw === 'THREE' ? dnsRaw : 'OFF';

  return {
    ...base,
    packageName,
    limits,
    resources,
    skin: String(raw.skin || base.skin),
    featureSets: featureSetsRaw
      ? { policy: 'selected', selected: splitDaList(featureSetsRaw) }
      : { policy: 'all', selected: base.featureSets.selected },
    pluginPolicy: { mode: pluginMode, allow: pluginAllow, deny: pluginDeny },
    features: {
      ...base.features,
      ips: String(raw.ips ?? base.features.ips),
      dns,
      aftp: parseDaBool(raw.aftp),
      cgi: parseDaBool(raw.cgi),
      git: parseDaBool(raw.git),
      wordpress: parseDaBool(raw.wordpress),
      clamav: parseDaBool(raw.clamav),
      php: raw.php != null ? parseDaBool(raw.php) : base.features.php,
      spam: raw.spam != null ? parseDaBool(raw.spam) : base.features.spam,
      catchall: parseDaBool(raw.catchall),
      ssl: raw.ssl != null ? parseDaBool(raw.ssl) : base.features.ssl,
      ssh: parseDaBool(raw.ssh),
      cron: raw.cron != null ? parseDaBool(raw.cron) : base.features.cron,
      redis: parseDaBool(raw.redis),
      sysinfo: raw.sysinfo != null ? parseDaBool(raw.sysinfo) : base.features.sysinfo,
      login_keys: raw.login_keys != null ? parseDaBool(raw.login_keys) : base.features.login_keys,
      dnscontrol: raw.dnscontrol != null ? parseDaBool(raw.dnscontrol) : base.features.dnscontrol,
      suspend_at_limit: raw.suspend_at_limit != null ? parseDaBool(raw.suspend_at_limit) : base.features.suspend_at_limit,
      auto_security_txt: parseDaBool(raw.auto_security_txt),
      jail: raw.jail != null ? parseDaBool(raw.jail) : base.features.jail,
      oversell: raw.oversell != null ? parseDaBool(raw.oversell) : base.features.oversell,
      userssh: parseDaBool(raw.userssh),
      serverip: raw.serverip != null ? parseDaBool(raw.serverip) : base.features.serverip,
    },
  };
}

/** Preenche o formulário a partir de uma linha da listagem (fallback). */
export function packageListRowToForm(pkg: Record<string, unknown>, packageName: string): ResellerPackageFormState {
  const form = createDefaultResellerPackageForm(packageName);
  const num = (v: unknown) => (v != null && v !== '' ? String(v) : '');
  const disk = num(pkg.diskSpace ?? pkg.disk);
  const band = num(pkg.bandwidth);
  const emails = num(pkg.emailAccounts ?? pkg.emails);
  const dbs = num(pkg.dataBases ?? pkg.databases);
  const ftps = num(pkg.ftpAccounts ?? pkg.ftp);
  const domains = num(pkg.allowedDomains ?? pkg.vdomains);
  if (disk) form.limits.quota = { value: disk, unlimited: false };
  if (band) form.limits.bandwidth = { value: band, unlimited: false };
  if (emails) form.limits.nemails = { value: emails, unlimited: false };
  if (dbs) form.limits.mysql = { value: dbs, unlimited: false };
  if (ftps) form.limits.ftp = { value: ftps, unlimited: false };
  if (domains) form.limits.vdomains = { value: domains, unlimited: false };
  return form;
}
