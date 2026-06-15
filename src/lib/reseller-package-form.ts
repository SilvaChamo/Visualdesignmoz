/** Valores por omissão alinhados com pacotes DirectAdmin (ex. VisualDESIGN). */

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

export type ResourceSetId = 'core_functions' | 'dns_only' | 'email_only';
export type ResourcePolicy = 'all' | 'selected';
export type PluginPolicy = 'allow_all' | 'block_selected' | 'allow_selected';

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
    php: boolean;
    spam: boolean;
    catchall: boolean;
    ssl: boolean;
    ssh: boolean;
    userssh: boolean;
    oversell: boolean;
    cron: boolean;
    sysinfo: boolean;
    login_keys: boolean;
    dnscontrol: boolean;
    serverip: boolean;
    dns: 'OFF' | 'TWO' | 'THREE';
    resourcePolicy: ResourcePolicy;
    resourceSets: Record<ResourceSetId, boolean>;
    pluginPolicy: PluginPolicy;
  };
  resources: Record<ResellerResourceField, { value: string; unlimited: boolean }>;
};

export const RESELLER_LIMIT_LABELS: Record<ResellerLimitField, string> = {
  bandwidth: 'Tráfego (MB)',
  quota: 'Espaço em disco (MB)',
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

export function createDefaultResellerPackageForm(packageName = ''): ResellerPackageFormState {
  return {
    packageMode: 'new',
    packageName,
    limits: {
      bandwidth: { value: '5000', unlimited: false },
      quota: { value: '1000', unlimited: false },
      inode: { value: '', unlimited: true },
      vdomains: { value: '10', unlimited: false },
      nsubdomains: { value: '10', unlimited: false },
      nemails: { value: '100', unlimited: false },
      nemailf: { value: '100', unlimited: false },
      nemailml: { value: '10', unlimited: false },
      nemailr: { value: '100', unlimited: false },
      mysql: { value: '0', unlimited: false },
      domainptr: { value: '0', unlimited: false },
      ftp: { value: '10', unlimited: false },
      nusers: { value: '', unlimited: true },
    },
    features: {
      ips: '0',
      aftp: false,
      cgi: true,
      git: true,
      wordpress: true,
      php: true,
      spam: true,
      catchall: false,
      ssl: true,
      ssh: true,
      userssh: false,
      oversell: true,
      cron: true,
      sysinfo: true,
      login_keys: true,
      dnscontrol: true,
      serverip: true,
      dns: 'OFF',
      resourcePolicy: 'selected',
      resourceSets: {
        core_functions: true,
        dns_only: false,
        email_only: false,
      },
      pluginPolicy: 'allow_all',
    },
    resources: {
      CPUQuota: { value: '400', unlimited: true },
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

/** Converte o formulário para campos da API DirectAdmin (pacotes user ou revenda). */
export function hostingPackageFormToDaFields(form: ResellerPackageFormState): Record<string, string> {
  const fields: Record<string, string> = {
    add: 'Save',
    packagename: form.packageName.trim(),
    ips: form.features.ips || '0',
    dns: form.features.dns,
  };

  for (const [key, row] of Object.entries(form.limits) as [ResellerLimitField, { value: string; unlimited: boolean }][]) {
    Object.assign(fields, limitToDa(key, row));
  }

  Object.assign(fields, boolToDa('aftp', form.features.aftp));
  Object.assign(fields, boolToDa('cgi', form.features.cgi));
  Object.assign(fields, boolToDa('git', form.features.git));
  Object.assign(fields, boolToDa('wordpress', form.features.wordpress));
  Object.assign(fields, boolToDa('php', form.features.php));
  Object.assign(fields, boolToDa('spam', form.features.spam));
  Object.assign(fields, boolToDa('catchall', form.features.catchall));
  Object.assign(fields, boolToDa('ssl', form.features.ssl));
  Object.assign(fields, boolToDa('ssh', form.features.ssh));
  Object.assign(fields, boolToDa('userssh', form.features.userssh));
  Object.assign(fields, boolToDa('oversell', form.features.oversell));
  Object.assign(fields, boolToDa('cron', form.features.cron));
  Object.assign(fields, boolToDa('sysinfo', form.features.sysinfo));
  Object.assign(fields, boolToDa('login_keys', form.features.login_keys));
  Object.assign(fields, boolToDa('dnscontrol', form.features.dnscontrol));
  Object.assign(fields, boolToDa('serverip', form.features.serverip));

  if (form.features.resourcePolicy === 'selected') {
    const sets = (Object.entries(form.features.resourceSets) as [ResourceSetId, boolean][])
      .filter(([, on]) => on)
      .map(([id]) => id);
    fields.feature_sets = sets.join(':');
  } else {
    fields.feature_sets = '';
  }

  if (form.features.pluginPolicy === 'allow_all') {
    fields.plugins_allow = '[clear]';
    fields.plugins_deny = '[clear]';
  } else if (form.features.pluginPolicy === 'allow_selected') {
    fields.plugins_allow = '';
    fields.plugins_deny = '[clear]';
  } else {
    fields.plugins_allow = '[clear]';
    fields.plugins_deny = '';
  }

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
