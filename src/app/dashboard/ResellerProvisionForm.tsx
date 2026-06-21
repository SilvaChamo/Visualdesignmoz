'use client';

import type { ResellerPackageFormState } from '@/lib/reseller-package-form';
import { DaFormRow } from '@/lib/panel-da-form-rows';
import { panelField } from '@/lib/panel-ui';
import { HostingDaPackageFields } from '@/app/dashboard/HostingDaPackageFields';

type Props = {
  form: ResellerPackageFormState;
  onChange: (next: ResellerPackageFormState) => void;
  existingPackages: string[];
  domain: string;
  onDomainChange: (domain: string) => void;
};

export function ResellerProvisionForm({
  form,
  onChange,
  existingPackages,
  domain,
  onDomainChange,
}: Props) {
  return (
    <div className="space-y-2">
      {existingPackages.length > 0 && (
        <DaFormRow label="Pacote existente" showUnlimited={false}>
          <select
            value={form.packageMode === 'existing' ? form.packageName : ''}
            onChange={(e) => {
              const name = e.target.value;
              if (!name) {
                onChange({ ...form, packageMode: 'new', packageName: form.packageName || '' });
                return;
              }
              onChange({ ...form, packageMode: 'existing', packageName: name });
            }}
            className={`${panelField} min-w-0 flex-1`}
          >
            <option value="">Criar novo pacote (formulário abaixo)</option>
            {existingPackages.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </DaFormRow>
      )}

      <DaFormRow label="Domínio principal" showUnlimited={false}>
        <input
          value={domain}
          onChange={(e) => onDomainChange(e.target.value)}
          placeholder="exemplo.com (opcional)"
          className={`${panelField} min-w-0 flex-1`}
        />
      </DaFormRow>

      <HostingDaPackageFields form={form} onChange={onChange} showPackageName />
    </div>
  );
}
