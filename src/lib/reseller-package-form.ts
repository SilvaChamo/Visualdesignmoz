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
  ownerDomain: string;
  appearanceMode: 'light' | 'dark';
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

export type HostingPlanPresetId =
  | 'hosting-basico'
  | 'hosting-pro'
  | 'hosting-business'
  | 'hosting-enterprise'
  | 'revenda-starter'
  | 'revenda-pro';

export type HostingPlanPreset = {
  id: HostingPlanPresetId;
  label: string;
  description: string;
  defaultPackageName: string;
  monthlyPriceMzn?: number;
  form: Omit<ResellerPackageFormState, 'packageMode' | 'packageName'>;
};

export function createDefaultResellerPackageForm(packageName = ''): ResellerPackageFormState {
  return {
    packageMode: 'new',
    packageName,
    ownerDomain: '',
    appearanceMode: 'light',
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

export function createEmptyResellerPackageForm(packageName = ''): ResellerPackageFormState {
  const base = createDefaultResellerPackageForm(packageName);
  const limits = Object.fromEntries(
    Object.entries(base.limits).map(([key]) => [key, { value: '', unlimited: true }]),
  ) as ResellerPackageFormState['limits'];
  const resources = Object.fromEntries(
    Object.entries(base.resources).map(([key]) => [key, { value: '', unlimited: true }]),
  ) as ResellerPackageFormState['resources'];
  return {
    ...base,
    limits,
    resources,
  };
}

type PresetFormOverrides = Partial<
  Omit<
    ResellerPackageFormState,
    'packageMode' | 'packageName' | 'limits' | 'resources' | 'features' | 'featureSets' | 'pluginPolicy'
  >
> & {
  limits?: Partial<ResellerPackageFormState['limits']>;
  resources?: Partial<ResellerPackageFormState['resources']>;
  features?: Partial<ResellerPackageFormState['features']>;
  featureSets?: Partial<ResellerPackageFormState['featureSets']>;
  pluginPolicy?: Partial<ResellerPackageFormState['pluginPolicy']>;
};

function buildPresetForm(overrides: PresetFormOverrides): Omit<ResellerPackageFormState, 'packageMode' | 'packageName'> {
  const base = createDefaultResellerPackageForm('');
  return {
    ownerDomain: overrides.ownerDomain ?? base.ownerDomain,
    appearanceMode: overrides.appearanceMode ?? base.appearanceMode,
    limits: {
      ...base.limits,
      ...(overrides.limits || {}),
    } as ResellerPackageFormState['limits'],
    features: {
      ...base.features,
      ...(overrides.features || {}),
    },
    skin: overrides.skin || base.skin,
    featureSets: {
      ...base.featureSets,
      ...(overrides.featureSets || {}),
      selected: overrides.featureSets?.selected || base.featureSets.selected,
    },
    pluginPolicy: {
      ...base.pluginPolicy,
      ...(overrides.pluginPolicy || {}),
      allow: overrides.pluginPolicy?.allow || base.pluginPolicy.allow,
      deny: overrides.pluginPolicy?.deny || base.pluginPolicy.deny,
    },
    resources: {
      ...base.resources,
      ...(overrides.resources || {}),
    } as ResellerPackageFormState['resources'],
  };
}

export const HOSTING_PLAN_PRESETS: HostingPlanPreset[] = [
  {
    // Sincronizado com a página pública /precos/hospedagem (4 planos oficiais).
    id: 'hosting-basico',
    label: 'Básico',
    description: 'Plano inicial para site institucional',
    defaultPackageName: 'VD-Host-Basico',
    monthlyPriceMzn: 680,
    form: buildPresetForm({
      limits: {
        quota: { value: '10000', unlimited: false },
        bandwidth: { value: '100000', unlimited: false },
        vdomains: { value: '1', unlimited: false },
        nsubdomains: { value: '', unlimited: true },
        nemails: { value: '10', unlimited: false },
        mysql: { value: '1', unlimited: false },
        ftp: { value: '', unlimited: true },
      },
      features: { wordpress: true, php: true, aftp: false, cron: true, git: false, ssl: true, spam: true },
      resources: {
        CPUQuota: { value: '150%', unlimited: false },
        MemoryHigh: { value: '512M', unlimited: false },
        MemoryMax: { value: '1G', unlimited: false },
      },
    }),
  },
  {
    id: 'hosting-pro',
    label: 'Profissional',
    description: 'Plano recomendado para a maioria dos sites',
    defaultPackageName: 'VD-Host-Pro',
    monthlyPriceMzn: 1040,
    form: buildPresetForm({
      limits: {
        quota: { value: '20000', unlimited: false },
        bandwidth: { value: '200000', unlimited: false },
        vdomains: { value: '5', unlimited: false },
        nsubdomains: { value: '', unlimited: true },
        nemails: { value: '20', unlimited: false },
        mysql: { value: '10', unlimited: false },
        ftp: { value: '', unlimited: true },
      },
      features: { wordpress: true, php: true, aftp: false, cron: true, git: true, ssl: true, spam: true },
      resources: {
        CPUQuota: { value: '250%', unlimited: false },
        MemoryHigh: { value: '1G', unlimited: false },
        MemoryMax: { value: '1500M', unlimited: false },
      },
    }),
  },
  {
    id: 'hosting-business',
    label: 'Business',
    description: 'Plano para operação com vários sites activos',
    defaultPackageName: 'VD-Host-Business',
    monthlyPriceMzn: 1360,
    form: buildPresetForm({
      limits: {
        quota: { value: '30000', unlimited: false },
        bandwidth: { value: '300000', unlimited: false },
        vdomains: { value: '', unlimited: true },
        nsubdomains: { value: '', unlimited: true },
        nemails: { value: '', unlimited: true },
        mysql: { value: '', unlimited: true },
        ftp: { value: '', unlimited: true },
      },
      features: { wordpress: true, php: true, aftp: false, cron: true, git: true, ssl: true, spam: true },
      resources: {
        CPUQuota: { value: '300%', unlimited: false },
        MemoryHigh: { value: '1500M', unlimited: false },
        MemoryMax: { value: '2G', unlimited: false },
      },
    }),
  },
  {
    id: 'hosting-enterprise',
    label: 'Enterprise',
    description: 'Plano de maior capacidade, para operações exigentes',
    defaultPackageName: 'VD-Host-Enterprise',
    monthlyPriceMzn: 2040,
    form: buildPresetForm({
      limits: {
        quota: { value: '40000', unlimited: false },
        bandwidth: { value: '400000', unlimited: false },
        vdomains: { value: '', unlimited: true },
        nsubdomains: { value: '', unlimited: true },
        nemails: { value: '', unlimited: true },
        mysql: { value: '', unlimited: true },
        ftp: { value: '', unlimited: true },
      },
      features: { wordpress: true, php: true, aftp: true, cron: true, git: true, ssl: true, spam: true },
      resources: {
        CPUQuota: { value: '400%', unlimited: false },
        MemoryHigh: { value: '2G', unlimited: false },
        MemoryMax: { value: '3G', unlimited: false },
      },
    }),
  },
  {
    id: 'revenda-starter',
    label: 'Revenda Básico',
    description: 'Plano revenda para começar com limites definidos',
    defaultPackageName: 'VD-Revenda-S',
    form: buildPresetForm({
      limits: {
        quota: { value: '20000', unlimited: false },
        bandwidth: { value: '200000', unlimited: false },
        vdomains: { value: '15', unlimited: false },
        nsubdomains: { value: '50', unlimited: false },
        nemails: { value: '100', unlimited: false },
        mysql: { value: '20', unlimited: false },
        ftp: { value: '20', unlimited: false },
        nusers: { value: '10', unlimited: false },
      },
      features: { wordpress: true, php: true, aftp: false, cron: true, git: true, ssl: true, spam: true, oversell: true },
      resources: {
        CPUQuota: { value: '400%', unlimited: false },
        MemoryHigh: { value: '2G', unlimited: false },
        MemoryMax: { value: '3G', unlimited: false },
      },
    }),
  },
  {
    id: 'revenda-pro',
    label: 'Revenda Pro',
    description: 'Plano revenda para carteira maior de clientes',
    defaultPackageName: 'VD-Revenda-M',
    form: buildPresetForm({
      limits: {
        quota: { value: '50000', unlimited: false },
        bandwidth: { value: '500000', unlimited: false },
        vdomains: { value: '40', unlimited: false },
        nsubdomains: { value: '150', unlimited: false },
        nemails: { value: '250', unlimited: false },
        mysql: { value: '50', unlimited: false },
        ftp: { value: '50', unlimited: false },
        nusers: { value: '25', unlimited: false },
      },
      features: { wordpress: true, php: true, aftp: false, cron: true, git: true, ssl: true, spam: true, oversell: true },
      resources: {
        CPUQuota: { value: '600%', unlimited: false },
        MemoryHigh: { value: '3G', unlimited: false },
        MemoryMax: { value: '4G', unlimited: false },
      },
    }),
  },
];

export function applyHostingPlanPreset(
  presetId: HostingPlanPresetId,
  options?: { packageName?: string; keepCurrentPackageName?: boolean; current?: ResellerPackageFormState },
): ResellerPackageFormState | null {
  const preset = HOSTING_PLAN_PRESETS.find((row) => row.id === presetId);
  if (!preset) return null;
  const preferredPackageName =
    options?.packageName ||
    (options?.keepCurrentPackageName ? options?.current?.packageName : '') ||
    preset.defaultPackageName;
  return {
    packageMode: 'new',
    packageName: preferredPackageName,
    ownerDomain: options?.current?.ownerDomain || preset.form.ownerDomain || '',
    appearanceMode: options?.current?.appearanceMode || preset.form.appearanceMode || 'light',
    limits: Object.fromEntries(
      Object.entries(preset.form.limits).map(([key, row]) => [key, { ...row }]),
    ) as ResellerPackageFormState['limits'],
    features: { ...preset.form.features },
    skin: preset.form.skin,
    featureSets: {
      ...preset.form.featureSets,
      selected: [...preset.form.featureSets.selected],
    },
    pluginPolicy: {
      ...preset.form.pluginPolicy,
      allow: [...preset.form.pluginPolicy.allow],
      deny: [...preset.form.pluginPolicy.deny],
    },
    resources: Object.fromEntries(
      Object.entries(preset.form.resources).map(([key, row]) => [key, { ...row }]),
    ) as ResellerPackageFormState['resources'],
  };
}

export function formatDomainForPackageName(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/\.+/g, '.')
    .replace(/^-+|-+$/g, '')
    .replace(/\./g, '_');
}

export function composePackageName(packageName: string, ownerDomain: string): string {
  const base = packageName.trim();
  const domainToken = formatDomainForPackageName(ownerDomain);
  if (!base) return '';
  if (!domainToken) return base;
  if (base.endsWith(`__${domainToken}`)) return base;
  return `${base}__${domainToken}`;
}

export function splitCompositePackageName(name: string): { packageName: string; ownerDomain: string } {
  const raw = name.trim();
  if (!raw.includes('__')) return { packageName: raw, ownerDomain: '' };
  const [base, domainToken] = raw.split('__', 2);
  return {
    packageName: base || raw,
    ownerDomain: domainToken ? domainToken.replace(/_/g, '.') : '',
  };
}

/** Pacotes históricos no servidor — nome próprio, não slug de domínio. */
const LEGACY_SERVER_PACKAGE_NAMES = new Set(['osher', 'visualdesign', 'default']);

function isHostingPresetPackageName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  if (LEGACY_SERVER_PACKAGE_NAMES.has(normalized)) return true;
  if (/^vd-/i.test(name.trim())) return true;
  return HOSTING_PLAN_PRESETS.some((preset) => preset.defaultPackageName.toLowerCase() === normalized);
}

function domainFromPackageSlug(slug: string): string {
  const raw = slug.trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('.')) return raw;
  return `${raw}.com`;
}

/** Separa nome técnico do pacote e domínio ao abrir o editor (inclui pacotes legados só com slug). */
export function normalizePackageFormForEditor(
  form: ResellerPackageFormState,
  serverPackageId: string,
): ResellerPackageFormState {
  const splitFromId = splitCompositePackageName(serverPackageId);
  const splitFromForm = splitCompositePackageName(form.packageName || '');

  let packageName =
    splitFromId.packageName ||
    splitFromForm.packageName ||
    form.packageName.trim();
  let ownerDomain =
    form.ownerDomain?.trim() ||
    splitFromId.ownerDomain ||
    splitFromForm.ownerDomain ||
    '';

  if (!ownerDomain) {
    const slug = (splitFromId.ownerDomain ? '' : splitFromId.packageName || packageName).trim();
    if (slug && !slug.includes('__') && !isHostingPresetPackageName(slug)) {
      ownerDomain = domainFromPackageSlug(slug);
      const presetId = inferHostingPlanPresetId({ ...form, packageName, ownerDomain });
      const preset = presetId ? getHostingPlanPresetById(presetId) : null;
      if (preset) packageName = preset.defaultPackageName;
    }
  }

  return { ...form, packageName, ownerDomain };
}

export function getHostingPlanPresetById(presetId: HostingPlanPresetId): HostingPlanPreset | null {
  return HOSTING_PLAN_PRESETS.find((row) => row.id === presetId) || null;
}

export function inferHostingPlanPresetId(form: ResellerPackageFormState): HostingPlanPresetId | null {
  const normalizedPackageName = form.packageName.trim().toLowerCase().split('__')[0] || form.packageName.trim().toLowerCase();
  const byName = HOSTING_PLAN_PRESETS.find(
    (preset) => preset.defaultPackageName.toLowerCase() === normalizedPackageName,
  );
  if (byName) return byName.id;

  const aliases: Record<string, HostingPlanPresetId> = {
    osher: 'hosting-business',
    visualdesign: 'hosting-business',
  };
  const alias = aliases[normalizedPackageName];
  if (alias) return alias;

  const comparableKeys: ResellerLimitField[] = ['quota', 'bandwidth', 'vdomains', 'nsubdomains', 'nemails', 'mysql', 'ftp'];
  for (const preset of HOSTING_PLAN_PRESETS) {
    const sameLimits = comparableKeys.every((key) => {
      const current = form.limits[key];
      const expected = preset.form.limits[key];
      return current.unlimited === expected.unlimited && String(current.value || '') === String(expected.value || '');
    });
    const sameCpu = form.resources.CPUQuota.value === preset.form.resources.CPUQuota.value;
    const sameMemory = form.resources.MemoryMax.value === preset.form.resources.MemoryMax.value;
    if (sameLimits && sameCpu && sameMemory) return preset.id;
  }

  return null;
}

function limitToDa(key: ResellerLimitField, row: { value: string; unlimited: boolean }): Record<string, string> {
  const normalizeLimitValue = (value: string): string => {
    const raw = String(value || '').trim();
    if (!raw) return '0';
    const m = raw.match(/^(\d+(?:[.,]\d+)?)/);
    if (!m) return raw;
    const num = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(num)) return raw;
    return String(Math.round(num));
  };

  const normalizeStorageMb = (value: string): string => {
    const normalized = normalizeLimitValue(value);
    const numeric = String(normalized).replace(/[^\d]/g, '');
    return numeric || '0';
  };

  if (row.unlimited) {
    if (key === 'bandwidth') return { bandwidth: 'unlimited', ubandwidth: 'ON' };
    if (key === 'quota') return { quota: 'unlimited', uquota: 'ON' };
    return { [key]: 'unlimited' };
  }
  const out: Record<string, string> = {
    [key]:
      key === 'quota' || key === 'bandwidth'
        ? normalizeStorageMb(row.value)
        : normalizeLimitValue(row.value),
  };
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
  if (!val) return fallback;
  return { value: val, unlimited: false };
}

/** Converte campos da API DirectAdmin para o estado do formulário de pacote. */
export function daPackageFieldsToHostingForm(
  raw: Record<string, string>,
  packageName: string,
  seed?: ResellerPackageFormState,
): ResellerPackageFormState {
  const base = seed ? { ...seed, packageName } : createDefaultResellerPackageForm(packageName);
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
      aftp: raw.aftp != null ? parseDaBool(raw.aftp) : base.features.aftp,
      cgi: raw.cgi != null ? parseDaBool(raw.cgi) : base.features.cgi,
      git: raw.git != null ? parseDaBool(raw.git) : base.features.git,
      wordpress: raw.wordpress != null ? parseDaBool(raw.wordpress) : base.features.wordpress,
      clamav: raw.clamav != null ? parseDaBool(raw.clamav) : base.features.clamav,
      php: raw.php != null ? parseDaBool(raw.php) : base.features.php,
      spam: raw.spam != null ? parseDaBool(raw.spam) : base.features.spam,
      catchall: raw.catchall != null ? parseDaBool(raw.catchall) : base.features.catchall,
      ssl: raw.ssl != null ? parseDaBool(raw.ssl) : base.features.ssl,
      ssh: raw.ssh != null ? parseDaBool(raw.ssh) : base.features.ssh,
      cron: raw.cron != null ? parseDaBool(raw.cron) : base.features.cron,
      redis: raw.redis != null ? parseDaBool(raw.redis) : base.features.redis,
      sysinfo: raw.sysinfo != null ? parseDaBool(raw.sysinfo) : base.features.sysinfo,
      login_keys: raw.login_keys != null ? parseDaBool(raw.login_keys) : base.features.login_keys,
      dnscontrol: raw.dnscontrol != null ? parseDaBool(raw.dnscontrol) : base.features.dnscontrol,
      suspend_at_limit: raw.suspend_at_limit != null ? parseDaBool(raw.suspend_at_limit) : base.features.suspend_at_limit,
      auto_security_txt: raw.auto_security_txt != null ? parseDaBool(raw.auto_security_txt) : base.features.auto_security_txt,
      jail: raw.jail != null ? parseDaBool(raw.jail) : base.features.jail,
      oversell: raw.oversell != null ? parseDaBool(raw.oversell) : base.features.oversell,
      userssh: raw.userssh != null ? parseDaBool(raw.userssh) : base.features.userssh,
      serverip: raw.serverip != null ? parseDaBool(raw.serverip) : base.features.serverip,
    },
  };
}

/** Preenche o formulário a partir de uma linha da listagem (fallback). */
export function packageListRowToForm(pkg: Record<string, unknown>, packageName: string): ResellerPackageFormState {
  const split = splitCompositePackageName(packageName);
  const form = createDefaultResellerPackageForm(split.packageName);
  form.ownerDomain = split.ownerDomain;
  const parseListLimit = (v: unknown): { value: string; unlimited: boolean } | null => {
    const raw = String(v ?? '').trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (raw === '-' || lower === 'unlimited' || lower === 'ilimitado') {
      return { value: '', unlimited: true };
    }
    return { value: raw, unlimited: false };
  };

  const disk = parseListLimit(pkg.diskSpace ?? pkg.disk);
  const band = parseListLimit(pkg.bandwidth);
  const emails = parseListLimit(pkg.emailAccounts ?? pkg.emails);
  const dbs = parseListLimit(pkg.dataBases ?? pkg.databases);
  const ftps = parseListLimit(pkg.ftpAccounts ?? pkg.ftp);
  const domains = parseListLimit(pkg.allowedDomains ?? pkg.vdomains);
  if (disk) form.limits.quota = disk;
  if (band) form.limits.bandwidth = band;
  if (emails) form.limits.nemails = emails;
  if (dbs) form.limits.mysql = dbs;
  if (ftps) form.limits.ftp = ftps;
  if (domains) form.limits.vdomains = domains;
  return form;
}
