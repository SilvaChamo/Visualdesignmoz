'use client';

import { useState } from 'react';
import { CheckCircle, ChevronRight, Globe, Loader2, Package, UserPlus } from 'lucide-react';
import type { DirectAdminPackage } from '@/lib/directadmin-api';

type AccountType = 'client' | 'reseller';
type Step = 1 | 2 | 3 | 4 | 5;

interface Props {
  packages: DirectAdminPackage[];
  onComplete?: () => void;
}

export function ProvisionClienteSection({ packages, onComplete }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [accountType, setAccountType] = useState<AccountType>('client');
  const [identity, setIdentity] = useState({
    firstName: '',
    lastName: '',
    email: '',
    userName: '',
    password: '',
    confirmPassword: '',
  });
  const [packageName, setPackageName] = useState('Default');
  const [hosting, setHosting] = useState({
    domain: '',
    adminEmail: '',
    php: '8.2',
  });
  const [options, setOptions] = useState({ createEmail: false, emailUser: 'info', issueSsl: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);

  const steps = [
    { n: 1, label: 'Tipo' },
    { n: 2, label: 'Identidade' },
    { n: 3, label: 'Pacote' },
    { n: 4, label: 'Hospedagem' },
    { n: 5, label: 'Opcional' },
  ] as const;

  const deriveUsername = () => {
    if (identity.userName.trim()) return identity.userName.trim();
    const fromDomain = hosting.domain.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
    if (fromDomain) return fromDomain;
    const fromEmail = identity.email.split('@')[0]?.replace(/[^a-z0-9]/gi, '').slice(0, 10);
    return fromEmail || 'cliente';
  };

  const canNext = () => {
    if (step === 2) {
      return (
        identity.email.includes('@') &&
        identity.password.length >= 8 &&
        identity.password === identity.confirmPassword
      );
    }
    if (step === 4) {
      return hosting.domain.includes('.') && hosting.adminEmail.includes('@');
    }
    return true;
  };

  const handleProvision = async () => {
    setBusy(true);
    setMsg('');
    const username = deriveUsername();
    const domain = hosting.domain.trim().toLowerCase();
    const adminEmail = hosting.adminEmail.trim() || identity.email;

    try {
      const res = await fetch('/api/admin/clientes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType,
          email: identity.email,
          password: identity.password,
          userName: username,
          domain: accountType === 'reseller' ? domain || `${username}.com` : domain,
          packageName,
          adminEmail,
          createEmail: options.createEmail,
          emailUser: options.emailUser,
          issueSsl: options.issueSsl,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(String(json.error || 'Falha ao criar conta'));
      }

      setDone(true);
      setMsg(`Conta ${accountType === 'reseller' ? username : domain} criada.`);
      onComplete?.();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao provisionar';
      setMsg(`Erro: ${message}`);
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Provisionamento concluído</h2>
        <p className="text-gray-600 mb-6">{msg}</p>
        <button
          onClick={() => { setDone(false); setStep(1); setMsg(''); }}
          className="px-5 py-2.5 bg-black text-white rounded-lg font-bold hover:bg-red-600"
        >
          Provisionar outro
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Criar conta completa</h1>
        <p className="text-gray-500 mt-1">
          Um formulário para criar utilizador no servidor, escolher pacote e domínio de uma vez.
          O <strong>Menu Anterior</strong> na barra lateral mantém todas as opções antigas separadas.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {steps.map((s) => (
          <button
            key={s.n}
            onClick={() => setStep(s.n as Step)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              step === s.n ? 'bg-red-600 text-white' : step > s.n ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {s.n}. {s.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900">Tipo de conta</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { id: 'client' as const, title: 'Cliente final', desc: 'Um domínio / site de hospedagem' },
                { id: 'reseller' as const, title: 'Revendedor', desc: 'Conta que gere vários clientes' },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setAccountType(opt.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    accountType === opt.id ? 'border-red-600 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-bold text-gray-900">{opt.title}</div>
                  <div className="text-sm text-gray-500 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2"><UserPlus className="w-5 h-5" /> Identidade</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input placeholder="Nome" value={identity.firstName} onChange={(e) => setIdentity({ ...identity, firstName: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
              <input placeholder="Apelido" value={identity.lastName} onChange={(e) => setIdentity({ ...identity, lastName: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
              <input placeholder="Email" type="email" value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })} className="px-3 py-2 border rounded-lg text-sm sm:col-span-2" />
              <input placeholder="Utilizador DA (opcional)" value={identity.userName} onChange={(e) => setIdentity({ ...identity, userName: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
              <input placeholder="Password (mín. 8)" type="password" value={identity.password} onChange={(e) => setIdentity({ ...identity, password: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
              <input placeholder="Confirmar password" type="password" value={identity.confirmPassword} onChange={(e) => setIdentity({ ...identity, confirmPassword: e.target.value })} className="px-3 py-2 border rounded-lg text-sm sm:col-span-2" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2"><Package className="w-5 h-5" /> Pacote</h2>
            <select value={packageName} onChange={(e) => setPackageName(e.target.value)} className="w-full px-3 py-2.5 border rounded-lg text-sm">
              <option value="Default">Default</option>
              {packages.map((p) => (
                <option key={p.packageName} value={p.packageName}>{p.packageName}</option>
              ))}
            </select>
            {packages.length === 0 && (
              <p className="text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">Nenhum pacote no espelho — será usado &quot;Default&quot;.</p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2"><Globe className="w-5 h-5" /> Hospedagem</h2>
            {accountType === 'client' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Domínio (exemplo.com)" value={hosting.domain} onChange={(e) => setHosting({ ...hosting, domain: e.target.value })} className="px-3 py-2 border rounded-lg text-sm sm:col-span-2" />
                <input placeholder="Email admin do domínio" type="email" value={hosting.adminEmail} onChange={(e) => setHosting({ ...hosting, adminEmail: e.target.value })} className="px-3 py-2 border rounded-lg text-sm sm:col-span-2" />
                <select value={hosting.php} onChange={(e) => setHosting({ ...hosting, php: e.target.value })} className="px-3 py-2 border rounded-lg text-sm">
                  <option value="8.2">PHP 8.2</option>
                  <option value="8.3">PHP 8.3</option>
                  <option value="8.1">PHP 8.1</option>
                </select>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                Revendedor: o domínio principal pode ser definido depois no DirectAdmin ou ao criar o primeiro cliente.
                Utilizador DA: <strong>{deriveUsername()}</strong>
              </p>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900">Opcional</h2>
            {accountType === 'client' && hosting.domain && (
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
                <input type="checkbox" checked={options.createEmail} onChange={(e) => setOptions({ ...options, createEmail: e.target.checked })} />
                <span className="text-sm">Criar email <input className="mx-1 px-2 py-0.5 border rounded w-24" value={options.emailUser} onChange={(e) => setOptions({ ...options, emailUser: e.target.value })} />@{hosting.domain}</span>
              </label>
            )}
            {accountType === 'client' && hosting.domain && (
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer">
                <input type="checkbox" checked={options.issueSsl} onChange={(e) => setOptions({ ...options, issueSsl: e.target.checked })} />
                <span className="text-sm">Emitir SSL Let&apos;s Encrypt para {hosting.domain}</span>
              </label>
            )}
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-1">
              <div><strong>Tipo:</strong> {accountType === 'client' ? 'Cliente final' : 'Revendedor'}</div>
              <div><strong>Email:</strong> {identity.email}</div>
              <div><strong>Pacote:</strong> {packageName}</div>
              {accountType === 'client' && <div><strong>Domínio:</strong> {hosting.domain}</div>}
            </div>
          </div>
        )}

        {msg && !done && (
          <p className={`mt-4 text-sm p-3 rounded-lg ${msg.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</p>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
            disabled={step === 1 || busy}
            className="px-4 py-2 text-sm font-medium text-gray-600 disabled:opacity-40"
          >
            Anterior
          </button>
          {step < 5 ? (
            <button
              onClick={() => setStep((s) => Math.min(5, s + 1) as Step)}
              disabled={!canNext()}
              className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-lg text-sm font-bold hover:bg-red-600 disabled:opacity-40"
            >
              Seguinte <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleProvision}
              disabled={busy || (accountType === 'client' && !hosting.domain)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Criar conta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
