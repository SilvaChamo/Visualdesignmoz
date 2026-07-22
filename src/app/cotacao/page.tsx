'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase-client';
import { BRANDS, CATEGORIES, findItem, formatMt, SELECAO_STORAGE_KEY, CUSTOM_CATEGORIA_ID, type SelectedCatalogItem } from '@/lib/pricing-catalog';
import { NotchSection } from '@/components/home/NotchSection';
import { Loader2, AlertCircle, ArrowRight, ArrowLeft, Building2, User, Lock, Package, ChevronDown, Trash2, Plus, Sparkles } from 'lucide-react';

interface OrderLineItem {
  id: string;
  categoriaId: string;
  produto: string;
  quantidade: number;
}

function minDeliveryDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

// Aceita rede móvel moçambicana (82/83 Tmcel, 84/85 Vodacom, 86/87 Movitel),
// com ou sem o indicativo +258, com ou sem espaços/traços.
function isValidMzPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('258') ? digits.slice(3) : digits;
  return /^8[2-7]\d{7}$/.test(local);
}

function CotacaoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: authUser, loading: authLoading, getRedirectPath } = useAuth();
  const isAuthenticated = authLoading ? null : !!authUser;

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'registering' | 'submitting' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Dados da Empresa (ou pessoa singular)
  const [tipoCliente, setTipoCliente] = useState<'empresa' | 'individual'>('empresa');
  const [empresa, setEmpresa] = useState('');
  const [nif, setNif] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefoneInstitucional, setTelefoneInstitucional] = useState('');
  const [emailInstitucional, setEmailInstitucional] = useState('');
  const [website, setWebsite] = useState('');

  // Responsável a Contactar
  const [responsavel, setResponsavel] = useState('');
  const [cargo, setCargo] = useState('');
  const [telefoneResponsavel, setTelefoneResponsavel] = useState('');
  const [emailResponsavel, setEmailResponsavel] = useState('');

  // Criar Conta (só para visitantes sem sessão) — auto-preenchido a partir do responsável
  const [nome, setNome] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [password, setPassword] = useState('');

  // Segurança contra bots no registo: campo-armadilha invisível (só bots que
  // preenchem tudo o caem aqui) + um desafio simples de soma.
  const [honeypot, setHoneypot] = useState('');
  const [captcha] = useState(() => ({
    a: 1 + Math.floor(Math.random() * 8),
    b: 1 + Math.floor(Math.random() * 8),
  }));
  const [captchaResposta, setCaptchaResposta] = useState('');

  const handleResponsavelBlur = () => {
    if (!nome && responsavel) setNome(responsavel);
  };
  const handleEmailResponsavelBlur = () => {
    if (!accountEmail && emailResponsavel) setAccountEmail(emailResponsavel);
  };

  // Serviço — lista única de linhas de encomenda; a primeira existe sempre,
  // mesmo com um só serviço, para que o cartão e a pré-visualização usem
  // sempre o mesmo formato (não há "principal" vs "adicionais").
  const categoryFor = (categoriaId: string) => CATEGORIES.find((c) => c.id === categoriaId) ?? CATEGORIES[0];
  const initialCategoriaId = (() => {
    const fromQuery = searchParams.get('categoria');
    return fromQuery && CATEGORIES.some((c) => c.id === fromQuery) ? fromQuery : CATEGORIES[0].id;
  })();
  const [lineItems, setLineItems] = useState<OrderLineItem[]>(() => {
    const cat = categoryFor(initialCategoriaId);
    return [{ id: crypto.randomUUID(), categoriaId: initialCategoriaId, produto: cat.items[0]?.name ?? '', quantidade: 1 }];
  });
  const [dataLimite, setDataLimite] = useState('');
  const [notas, setNotas] = useState('');

  const updateLineItemCategoria = (id: string, categoriaId: string) => {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.id !== id) return li;
        const cat = categoryFor(categoriaId);
        return { ...li, categoriaId, produto: cat.items[0]?.name ?? '' };
      })
    );
  };
  const updateLineItemProduto = (id: string, produto: string) => {
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, produto } : li)));
  };
  const updateLineItemQuantidade = (id: string, quantidade: number) => {
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, quantidade } : li)));
  };
  const removeLineItem = (id: string) => {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((li) => li.id !== id)));
  };
  const addLineItem = () => {
    const cat = CATEGORIES[0];
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), categoriaId: cat.id, produto: '', quantidade: 1 },
    ]);
  };

  // Selecção feita por checkboxes em /precos (vários serviços, possivelmente
  // de categorias diferentes) — cada um vira a sua própria linha, todas no
  // mesmo formato de cartão.
  useEffect(() => {
    const raw = sessionStorage.getItem(SELECAO_STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(SELECAO_STORAGE_KEY);
    try {
      const items: SelectedCatalogItem[] = JSON.parse(raw);
      if (!items.length) return;
      setLineItems(
        items.map((item) => ({
          id: crypto.randomUUID(),
          categoriaId:
            item.categoriaId === CUSTOM_CATEGORIA_ID || CATEGORIES.some((c) => c.id === item.categoriaId)
              ? item.categoriaId
              : CATEGORIES[0].id,
          produto: item.produto,
          quantidade: 1,
        }))
      );
    } catch (e) {
      console.error('Erro ao ler selecção de /precos:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minDate = minDeliveryDate();
  const dataLimiteCedoDemais = dataLimite !== '' && dataLimite < minDate;

  // Preços agregados — cada item com preço fixo entra no total pela sua
  // própria quantidade; itens Sob Consulta ficam de fora do total (o valor
  // é definido depois, por contacto).
  const multiItemsPriced = lineItems.map((li) => {
    const isCustom = li.categoriaId === CUSTOM_CATEGORIA_ID;
    const found = isCustom ? undefined : findItem(li.categoriaId, li.produto);
    const sobConsultaItem = isCustom || Boolean(found?.item.sobConsulta);
    const subtotal = found && !sobConsultaItem ? found.item.price * li.quantidade : 0;
    return {
      li,
      isCustom,
      categoriaLabel: isCustom ? 'Pedido Personalizado' : categoryFor(li.categoriaId).label,
      qty: li.quantidade,
      precoUnitario: found?.item.price ?? 0,
      sobConsultaItem,
      subtotal,
    };
  });
  const multiTotal = multiItemsPriced.reduce((sum, i) => sum + i.subtotal, 0);
  const hasSobConsultaItem = multiItemsPriced.some((i) => i.sobConsultaItem);

  // Separadores da pré-visualização: cada linha só aparece depois de a secção
  // imediatamente anterior ter mesmo conteúdo preenchido — nunca ficam duas
  // linhas seguidas sem nada entre elas.
  const entidadeTemDados = Boolean(empresa || endereco || telefoneInstitucional || emailInstitucional || nif || website);
  const mostrarSeccaoResponsavel = tipoCliente === 'empresa' && currentStep >= 1;
  const responsavelTemDados = Boolean(responsavel || telefoneResponsavel || emailResponsavel);
  const mostrarLinhaAntesServicos = mostrarSeccaoResponsavel ? responsavelTemDados : entidadeTemDados;

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-10 h-10 animate-spin text-red-600" />
      </div>
    );
  }

  const baseSteps =
    tipoCliente === 'individual'
      ? [{ key: 'empresa', label: 'Os Seus Dados', icon: User }]
      : [
          { key: 'empresa', label: 'Empresa', icon: Building2 },
          { key: 'responsavel', label: 'Responsável', icon: User },
        ];
  const STEPS = isAuthenticated
    ? [...baseSteps, { key: 'servico', label: 'Serviço', icon: Package }]
    : [...baseSteps, { key: 'conta', label: 'Criar Conta', icon: Lock }, { key: 'servico', label: 'Serviço', icon: Package }];
  const stepKey = STEPS[currentStep].key;
  const isLastStep = currentStep === STEPS.length - 1;

  const validateStep = (key: string): string | null => {
    if (key === 'empresa') {
      if (!empresa.trim()) return tipoCliente === 'individual' ? 'Preencha o seu nome completo.' : 'Preencha o nome da empresa.';
      if (!telefoneInstitucional.trim()) return 'Preencha o contacto.';
      if (!isValidMzPhone(telefoneInstitucional)) return 'Indique um número de telefone moçambicano válido (ex: +258 84 000 0000).';
      if (!emailInstitucional.trim()) return 'Preencha o email.';
    }
    if (key === 'responsavel') {
      if (!responsavel.trim()) return 'Preencha o nome do responsável.';
      if (!telefoneResponsavel.trim()) return 'Preencha o telefone do responsável.';
      if (!isValidMzPhone(telefoneResponsavel)) return 'Indique um número de telefone moçambicano válido (ex: +258 84 000 0000).';
      if (!emailResponsavel.trim()) return 'Preencha o email do responsável.';
    }
    if (key === 'conta') {
      if (!nome.trim()) return 'Preencha o seu nome completo.';
      if (!accountEmail.trim()) return 'Preencha o seu email.';
      if (password.length < 6) return 'A palavra-passe deve ter no mínimo 6 caracteres.';
      if (honeypot.trim()) return 'Não foi possível validar o formulário.';
      if (Number(captchaResposta) !== captcha.a + captcha.b) return 'Resposta da verificação de segurança está incorrecta.';
    }
    if (key === 'servico') {
      if (lineItems.some((li) => (li.categoriaId === CUSTOM_CATEGORIA_ID ? !li.produto.trim() : !findItem(li.categoriaId, li.produto)))) {
        return 'Escolha o produto e a quantidade — ou descreva o pedido personalizado.';
      }
      if (multiItemsPriced.some((i) => i.qty <= 0)) return 'Indique a quantidade de todos os serviços seleccionados.';
      if (!dataLimite) return 'Escolha a data-limite de entrega.';
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(stepKey);
    if (err) {
      setErrorMessage(err);
      setStatus('error');
      return;
    }
    setErrorMessage('');
    setStatus('idle');
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setErrorMessage('');
    setStatus('idle');
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleApprove = async () => {
    if (isSubmitting) return;
    const err = validateStep('servico');
    if (err) {
      setErrorMessage(err);
      setStatus('error');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage('');
    setStatus('idle');

    try {
      if (isAuthenticated === false) {
        setStatus('registering');
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: accountEmail, password, nome, honeypot }),
        });
        const data = await res.json();

        if (!res.ok) {
          if (data.error?.includes('Já existe uma conta') || data.error?.includes('already')) {
            try {
              await supabase.auth.signInWithPassword({ email: accountEmail, password });
            } catch (loginErr) {
              throw new Error('Já existe uma conta com este email. Por favor, faça login para continuar.');
            }
          } else {
            throw new Error(data.error || 'Erro ao criar a sua conta.');
          }
        } else if (!data.sessionReady) {
          // Salvaguarda rara: a sessão normalmente já vem pronta na resposta
          // de /api/auth/register (autenticada no servidor). Só cai aqui se
          // esse passo falhar por algum motivo — tenta uma vez a partir do browser.
          try {
            await supabase.auth.signInWithPassword({ email: accountEmail, password });
          } catch (e) {}
        }
      }

      // Para pessoa singular, o passo "Responsável" nem chega a aparecer —
      // usa os próprios dados do passo "Os Seus Dados" como contacto.
      const finalResponsavel = tipoCliente === 'individual' ? empresa : responsavel;
      const finalCargo = tipoCliente === 'individual' ? '' : cargo;
      const finalTelefoneResponsavel = tipoCliente === 'individual' ? telefoneInstitucional : telefoneResponsavel;
      const finalEmailResponsavel = tipoCliente === 'individual' ? emailInstitucional : emailResponsavel;

      const itens = lineItems.map((li) => ({
        categoriaId: li.categoriaId,
        produto: li.produto,
        quantidade: li.quantidade,
      }));

      setStatus('submitting');
      const res = await fetch('/api/cotacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa,
          nif,
          endereco,
          telefoneInstitucional,
          emailInstitucional,
          website,
          responsavel: finalResponsavel,
          cargo: finalCargo,
          telefone: finalTelefoneResponsavel,
          email: isAuthenticated ? finalEmailResponsavel || authUser?.email : finalEmailResponsavel,
          itens,
          dataLimiteEntrega: dataLimite,
          notas,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível gerar a cotação.');
      }
      const redirectPath = await getRedirectPath();
      router.push(redirectPath || '/guest');
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao comunicar com o servidor.');
      setStatus('error');
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all text-sm';
  const labelClass = 'text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1.5 block';
  const sectionTitleClass = 'text-lg font-bold text-zinc-900 dark:text-white mb-4';

  return (
    <div className="min-h-screen bg-zinc-200 dark:bg-zinc-950">
      {/* Banner */}
      <NotchSection shape="start" bg="bg-gradient-to-br from-black via-zinc-900 to-zinc-950" first>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="container mx-auto max-w-7xl px-6 pt-[170px] pb-[70px] relative z-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Pedir Cotação</h1>
          <p className="text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed mb-4">
            Preencha os dados abaixo — acompanhe a pré-visualização da sua cotação ao lado.
          </p>
          <nav className="text-xs text-zinc-400">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <span className="mx-2">/</span>
            <Link href="/precos" className="hover:text-white transition-colors">Preços</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-300">Pedir Cotação</span>
          </nav>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <div className="h-[2px] bg-gradient-to-r from-transparent via-zinc-500 to-transparent" />
          <div className="h-[1px] bg-gradient-to-r from-transparent via-red-600 to-transparent" />
        </div>
      </NotchSection>

      <div className="bg-zinc-200 dark:bg-zinc-950">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-16">
        <div className="mx-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Formulário em etapas */}
          <div className="lg:col-span-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 sm:p-8">

            {/* Indicador de etapas */}
            <div className="flex items-start justify-center mb-8">
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isActive = idx === currentStep;
                const isDone = idx < currentStep;
                return (
                  <React.Fragment key={step.key}>
                    <div className="flex flex-col items-center gap-1.5 w-16 sm:w-20">
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center border-2 transition-colors ${
                          isActive
                            ? 'bg-red-600 border-red-600 text-white'
                            : isDone
                            ? 'bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-zinc-900'
                            : 'bg-transparent border-zinc-300 dark:border-zinc-700 text-zinc-400 dark:text-zinc-600'
                        }`}
                      >
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <span className={`text-[10px] sm:text-xs font-bold text-center ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-600'}`}>
                        {step.label}
                      </span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mt-4 sm:mt-5 ${isDone ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-200 dark:bg-zinc-800'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {status === 'error' && errorMessage && (
              <div className="mb-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-800 dark:text-red-300">{errorMessage}</p>
              </div>
            )}

            {stepKey === 'empresa' && (
              <>
                <div className="flex items-center gap-2 mb-5 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-md w-fit">
                  <button
                    type="button"
                    onClick={() => setTipoCliente('empresa')}
                    className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${
                      tipoCliente === 'empresa' ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    Empresa
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoCliente('individual')}
                    className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${
                      tipoCliente === 'individual' ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    Particular
                  </button>
                </div>

                <h2 className={sectionTitleClass}>{tipoCliente === 'individual' ? 'Os Seus Dados' : 'Dados da Empresa'}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>{tipoCliente === 'individual' ? 'Nome Completo' : 'Nome da Empresa'}</label>
                    <input className={inputClass} value={empresa} onChange={(e) => setEmpresa(e.target.value)} required />
                  </div>
                  <div>
                    <label className={labelClass}>NIF/NUIT (opcional, importante para facturação)</label>
                    <input className={inputClass} value={nif} onChange={(e) => setNif(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Endereço (opcional)</label>
                    <input className={inputClass} value={endereco} onChange={(e) => setEndereco(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>{tipoCliente === 'individual' ? 'Telefone' : 'Contacto Institucional'}</label>
                    <input type="tel" placeholder="+258 84 000 0000" className={inputClass} value={telefoneInstitucional} onChange={(e) => setTelefoneInstitucional(e.target.value)} required />
                  </div>
                  <div>
                    <label className={labelClass}>{tipoCliente === 'individual' ? 'Email' : 'Email Institucional'}</label>
                    <input type="email" className={inputClass} value={emailInstitucional} onChange={(e) => setEmailInstitucional(e.target.value)} required />
                  </div>
                  {tipoCliente === 'empresa' && (
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Website (opcional)</label>
                      <input className={inputClass} placeholder="www.example.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    </div>
                  )}
                </div>
              </>
            )}

            {stepKey === 'responsavel' && (
              <>
                <h2 className={sectionTitleClass}>Responsável a Contactar</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Nome do Responsável</label>
                    <input className={inputClass} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} onBlur={handleResponsavelBlur} required />
                  </div>
                  <div>
                    <label className={labelClass}>Cargo (opcional)</label>
                    <input className={inputClass} value={cargo} onChange={(e) => setCargo(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Telefone do Responsável</label>
                    <input type="tel" placeholder="+258 84 000 0000" className={inputClass} value={telefoneResponsavel} onChange={(e) => setTelefoneResponsavel(e.target.value)} required />
                  </div>
                  <div>
                    <label className={labelClass}>Email do Responsável</label>
                    <input type="email" className={inputClass} value={emailResponsavel} onChange={(e) => setEmailResponsavel(e.target.value)} onBlur={handleEmailResponsavelBlur} required />
                  </div>
                </div>
              </>
            )}

            {stepKey === 'conta' && (
              <>
                <h2 className={sectionTitleClass}>Criar Conta</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Nome Completo</label>
                    <input className={inputClass} value={nome} onChange={(e) => setNome(e.target.value)} required />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" className={inputClass} value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} required />
                  </div>
                  <div>
                    <label className={labelClass}>Palavra-passe</label>
                    <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Verificação de segurança — quanto é {captcha.a} + {captcha.b}?</label>
                    <input
                      type="number"
                      className={inputClass}
                      value={captchaResposta}
                      onChange={(e) => setCaptchaResposta(e.target.value)}
                      required
                    />
                  </div>
                  {/* Campo-armadilha: invisível para pessoas, mas bots que preenchem
                      todos os campos do formulário costumam preenchê-lo também. */}
                  <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
                    <label htmlFor="hp_confirmar">Não preencher este campo</label>
                    <input
                      id="hp_confirmar"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {stepKey === 'servico' && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`${sectionTitleClass} mb-0`}>Serviço</h2>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar serviço</span>
                  </button>
                </div>

                <div className="mb-4">
                  <label className={labelClass}>Serviços seleccionados</label>
                  <div className="flex flex-col gap-3">
                    {lineItems.map((li) => {
                      if (li.categoriaId === CUSTOM_CATEGORIA_ID) {
                        return (
                          <div
                            key={li.id}
                            className="flex items-start gap-3 p-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Sparkles className="w-3.5 h-3.5 text-red-600 dark:text-red-500 shrink-0" />
                                <span className="text-sm font-semibold text-zinc-900 dark:text-white">Pedido Personalizado</span>
                              </div>
                              <textarea
                                value={li.produto}
                                onChange={(e) => updateLineItemProduto(li.id, e.target.value)}
                                rows={2}
                                className="w-full bg-transparent text-xs text-zinc-500 dark:text-zinc-400 focus:outline-none resize-none border-0 p-0"
                                placeholder="Descreva o que precisa..."
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeLineItem(li.id)}
                              disabled={lineItems.length <= 1}
                              className="shrink-0 text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              aria-label="Remover serviço"
                              title={lineItems.length <= 1 ? 'Tem de manter pelo menos um serviço' : 'Remover este serviço'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      }
                      const cat = categoryFor(li.categoriaId);
                      return (
                        <div
                          key={li.id}
                          className="flex items-center gap-3 p-3 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                        >
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="relative inline-block max-w-full">
                              <select
                                value={li.categoriaId}
                                onChange={(e) => updateLineItemCategoria(li.id, e.target.value)}
                                className="appearance-none bg-transparent text-sm font-semibold text-zinc-900 dark:text-white cursor-pointer focus:outline-none truncate max-w-full pr-4"
                              >
                                {BRANDS.map((brand) => {
                                  const brandCategories = CATEGORIES.filter((c) => c.brand === brand.id);
                                  if (brandCategories.length === 0) return null;
                                  return (
                                    <optgroup key={brand.id} label={brand.label}>
                                      {brandCategories.map((c) => (
                                        <option key={c.id} value={c.id}>{c.label}</option>
                                      ))}
                                    </optgroup>
                                  );
                                })}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                            <div className="relative inline-block max-w-full">
                              <select
                                value={li.produto}
                                onChange={(e) => updateLineItemProduto(li.id, e.target.value)}
                                className={`appearance-none bg-transparent text-xs cursor-pointer focus:outline-none truncate max-w-full pr-4 ${li.produto ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-500 italic'}`}
                              >
                                {!li.produto && <option value="">Seleccionar serviço</option>}
                                {cat.items.map((p) => (
                                  <option key={p.name} value={p.name}>{p.name}{p.sobConsulta ? ' (Sob Consulta)' : ''}</option>
                                ))}
                              </select>
                              <ChevronDown className="w-3 h-3 text-zinc-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </div>
                          <div className="w-20 shrink-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Qtd.</label>
                              <button
                                type="button"
                                onClick={() => removeLineItem(li.id)}
                                disabled={lineItems.length <= 1}
                                className="shrink-0 text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                aria-label="Remover serviço"
                                title={lineItems.length <= 1 ? 'Tem de manter pelo menos um serviço' : 'Remover este serviço'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              className={inputClass}
                              value={li.quantidade === 0 ? '' : li.quantidade}
                              onChange={(e) => {
                                const raw = e.target.value;
                                updateLineItemQuantidade(li.id, raw === '' ? 0 : Math.round(Number(raw)));
                              }}
                              onBlur={() => updateLineItemQuantidade(li.id, li.quantidade > 0 ? li.quantidade : 1)}
                              required
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Data-Limite de Entrega Pretendida</label>
                    <input
                      type="date"
                      min={minDate}
                      className={inputClass}
                      value={dataLimite}
                      onChange={(e) => setDataLimite(e.target.value)}
                      required
                    />
                    <p className={`text-xs mt-1 ${dataLimiteCedoDemais ? 'text-red-600 dark:text-red-500' : 'text-zinc-400 dark:text-zinc-500'}`}>
                      Prazo mínimo de execução: 7 dias úteis a partir de hoje.
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Notas (opcional)</label>
                    <textarea
                      className={inputClass}
                      rows={3}
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Detalhes adicionais sobre o serviço pretendido..."
                    />
                  </div>
                </div>
              </>
            )}

            {isLastStep && (
              <div className="mt-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-300 font-medium leading-relaxed">
                  A entrega pretendida é até {dataLimite ? new Date(dataLimite).toLocaleDateString('pt-PT') : '—'}, com prazo mínimo de execução de 7 dias úteis.{' '}
                  {multiTotal > 0
                    ? `Para dar início à produção, é necessário adiantar 70% do valor total da factura: ${formatMt(multiTotal * 1.16 * 0.7)} MT.${hasSobConsultaItem ? ' Os serviços Sob Consulta são confirmados por contacto à parte.' : ''}`
                    : 'Estes serviços são Sob Consulta — entraremos em contacto para confirmar o valor e as condições de pagamento.'}
                </p>
              </div>
            )}

            {/* Navegação entre etapas */}
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
              {isLastStep ? (
                <div className="flex items-center gap-3">
                  {currentStep > 0 && (
                    <button
                      type="button"
                      onClick={goBack}
                      className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 font-bold text-sm hover:text-zinc-900 dark:hover:text-white transition-colors shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {currentStep > 0 ? (
                    <button
                      type="button"
                      onClick={goBack}
                      className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 font-bold text-sm hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                  ) : (
                    <Link
                      href="/precos"
                      className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 font-bold text-sm hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold px-6 py-2.5 rounded-md text-sm hover:opacity-90 transition-opacity"
                  >
                    <span>Seguinte</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Barra lateral — pré-visualização */}
          <div className="lg:col-span-1 lg:sticky lg:top-[105px] self-start">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <div className="bg-zinc-900 dark:bg-black px-6 py-4 border-b-2 border-red-600">
                <h3 className="text-sm font-bold uppercase tracking-wide text-white">Pré-visualização da Cotação</h3>
                <p className="text-xs text-zinc-400 mt-1">Assim ficará a sua cotação depois de submetida.</p>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1 text-sm">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 pb-1.5 mb-1.5 border-b border-zinc-300 dark:border-zinc-600">Entidade</h4>
                  {empresa && <p><span className="font-bold text-zinc-900 dark:text-white">Nome: </span><span className="text-zinc-600 dark:text-zinc-300">{empresa}</span></p>}
                  {endereco && <p><span className="font-bold text-zinc-900 dark:text-white">Província: </span><span className="text-zinc-600 dark:text-zinc-300">{endereco}</span></p>}
                  {telefoneInstitucional && <p><span className="font-bold text-zinc-900 dark:text-white">Contacto: </span><span className="text-zinc-600 dark:text-zinc-300">{telefoneInstitucional}</span></p>}
                  {emailInstitucional && <p><span className="font-bold text-zinc-900 dark:text-white">E-mail: </span><span className="text-zinc-600 dark:text-zinc-300">{emailInstitucional}</span></p>}
                  {nif && <p><span className="font-bold text-zinc-900 dark:text-white">Nuit: </span><span className="text-zinc-600 dark:text-zinc-300">{nif}</span></p>}
                  {website && <p><span className="font-bold text-zinc-900 dark:text-white">Website: </span><span className="text-zinc-600 dark:text-zinc-300">{website}</span></p>}
                </div>

                {mostrarSeccaoResponsavel && (
                  <div className="space-y-1 text-sm">
                    <h4 className="text-sm font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 pb-1.5 mb-1.5 border-b border-zinc-300 dark:border-zinc-600">Responsável</h4>
                    {responsavel && <p><span className="font-bold text-zinc-900 dark:text-white">Ponto focal: </span><span className="text-zinc-600 dark:text-zinc-300">{responsavel}{cargo ? ` — ${cargo}` : ''}</span></p>}
                    {telefoneResponsavel && <p><span className="font-bold text-zinc-900 dark:text-white">Contacto: </span><span className="text-zinc-600 dark:text-zinc-300">{telefoneResponsavel}</span></p>}
                    {emailResponsavel && <p><span className="font-bold text-zinc-900 dark:text-white">E-mail: </span><span className="text-zinc-600 dark:text-zinc-300">{emailResponsavel}</span></p>}
                  </div>
                )}

                <div className={`space-y-3 text-sm ${mostrarLinhaAntesServicos ? 'border-t border-zinc-300 dark:border-zinc-600 pt-4' : ''}`}>
                  {multiItemsPriced.map(({ li, categoriaLabel, qty, sobConsultaItem, precoUnitario }) => (
                    <div key={li.id}>
                      <p className="font-semibold text-zinc-900 dark:text-white">{categoriaLabel}</p>
                      <p className="text-zinc-500 dark:text-zinc-400">{li.produto}</p>
                      {sobConsultaItem ? (
                        <p className="text-sm font-bold text-red-600 dark:text-red-500 mt-0.5">Sob Consulta</p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-zinc-500 dark:text-zinc-400">Quantidade</span>
                            <span className="text-zinc-800 dark:text-zinc-200">{qty}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-500 dark:text-zinc-400">V. Unitário</span>
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">{formatMt(precoUnitario)} MT</span>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t border-zinc-300 dark:border-zinc-600 pt-4 space-y-1.5 text-sm">
                  {multiTotal > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400">Subtotal</span>
                        <span className="text-zinc-800 dark:text-zinc-200">{formatMt(multiTotal)} MT</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 dark:text-zinc-400">IVA (16%, acrescido)</span>
                        <span className="text-zinc-800 dark:text-zinc-200">{formatMt(multiTotal * 0.16)} MT</span>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-zinc-300 dark:border-zinc-600">
                        <span className="font-bold text-zinc-900 dark:text-white">Valor Total</span>
                        <span className="font-bold text-red-600 dark:text-red-500">{formatMt(multiTotal * 1.16)} MT</span>
                      </div>
                    </>
                  )}
                  {hasSobConsultaItem && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 italic pt-1">
                      {multiTotal > 0
                        ? 'Os serviços Sob Consulta não entram neste total — entraremos em contacto para confirmar o valor.'
                        : 'Este serviço é Sob Consulta — entraremos em contacto para confirmar o valor e as condições de pagamento.'}
                    </p>
                  )}
                </div>

                {isLastStep && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-md transition-all shadow-lg shadow-red-600/20 text-sm"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{status === 'registering' ? 'A criar a sua conta...' : 'A gerar a cotação...'}</span>
                        </>
                      ) : (
                        <>
                          <span>Submeter Pedido</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>

          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default function CotacaoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <Loader2 className="w-10 h-10 animate-spin text-red-600" />
        </div>
      }
    >
      <CotacaoContent />
    </Suspense>
  );
}
