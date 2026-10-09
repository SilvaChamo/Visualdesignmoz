'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase-client';
import { ENCOMENDAS_ACCOUNT_ORIGIN } from '@/lib/panel-origin';
import { BRANDS, CATEGORIES, findItem, formatMt, SELECAO_STORAGE_KEY, CUSTOM_CATEGORIA_ID, type SelectedCatalogItem } from '@/lib/pricing-catalog';
import {
  ENCOMENDA_CHECKOUT_PATH,
  descartarEncomendaRegistada,
  encomendaDraftSignature,
  loadEncomendaDraft,
  saveEncomendaDraft,
  type EncomendaDraft,
} from '@/lib/encomenda-checkout';
import { NotchSection } from '@/components/home/NotchSection';
import { AlertCircle, ArrowRight, ArrowLeft, Building2, User, Lock, Package, ChevronDown, Trash2, Plus, Sparkles, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface OrderLineItem {
  id: string;
  categoriaId: string;
  produto: string;
  quantidade: number;
}

// Soma dias úteis (ignora sábados e domingos) — usado para pré-preencher a
// data-limite de entrega com a margem mínima proposta, a partir de hoje.
function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  return d;
}

function minDeliveryDate() {
  return addBusinessDays(new Date(), 7).toISOString().split('T')[0];
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
  const { user: authUser, loading: authLoading } = useAuth();
  const isAuthenticated = authLoading ? null : !!authUser;
  // Embutido dentro do painel de encomendas (iframe, ver EncomendasListSection)
  // — cliente já autenticado, a pedir mais um serviço. Salta os passos
  // "Empresa"/"Responsável"/"Criar Conta" (dados já conhecidos de uma
  // encomenda anterior, ver efeito de pré-preenchimento abaixo) e vai direito
  // ao passo "Serviço", que já era o único necessário neste caso.
  // Só entra em modo painel com sessão confirmada — um acesso directo a
  // ?panel=1 sem sessão (fora do iframe autenticado de /encomendas) cai no
  // formulário público normal em vez de tentar saltar passos sem ter os
  // dados da empresa/responsável para preencher sozinho.
  const isPanelEmbed = searchParams.get('panel') === '1' && isAuthenticated === true;
  // Baseado directamente no parâmetro (não em isPanelEmbed, que só fica
  // verdadeiro depois de authLoading resolver) — assim começa já a "true"
  // sem depender dessa corrida, evitando mostrar por instantes os campos
  // vazios antes dos dados da última encomenda chegarem.
  const [prefillLoading, setPrefillLoading] = useState(searchParams.get('panel') === '1');
  // Sinaliza que este iframe está embutido dentro de /encomendas mesmo antes
  // de a sessão confirmar (isPanelEmbed só fica true depois disso).
  const isEmbeddedFrame = searchParams.get('embed') === '1';

  // Se a sessão expirar enquanto o iframe "Nova Encomenda" está aberto,
  // isPanelEmbed passa a false e este componente cairia no formulário
  // público normal (com cabeçalho e login) — mas isso ficaria preso dentro
  // da caixinha pequena do iframe, em vez do utilizador ver um ecrã de login
  // a sério. Em vez disso, navega a janela de topo para /login: sai do
  // iframe por completo.
  useEffect(() => {
    if (isEmbeddedFrame && isAuthenticated === false) {
      const loginUrl = `/login?redirect=${encodeURIComponent('/encomendas')}`;
      if (typeof window !== 'undefined' && window.top) {
        window.top.location.href = loginUrl;
      }
    }
  }, [isEmbeddedFrame, isAuthenticated]);

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Dados da Empresa (ou pessoa singular)
  const [tipoCliente, setTipoCliente] = useState<'empresa' | 'individual'>('empresa');
  const [empresa, setEmpresa] = useState('');
  const [nif, setNif] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefoneInstitucional, setTelefoneInstitucional] = useState('+258 ');
  const [emailInstitucional, setEmailInstitucional] = useState('');
  const [website, setWebsite] = useState('https://');

  // Responsável a Contactar
  const [responsavel, setResponsavel] = useState('');
  const [cargo, setCargo] = useState('');
  const [telefoneResponsavel, setTelefoneResponsavel] = useState('+258 ');
  const [emailResponsavel, setEmailResponsavel] = useState('');

  // Passo 2 — "Criar Conta": a conta (e o contacto da encomenda) nasce com
  // os dados do responsável ou com os da própria empresa, à escolha do
  // cliente. É criada aqui, ao avançar deste passo — o checkout fica só para
  // pagar, sem um segundo formulário de conta. Para pessoa singular usa
  // sempre os dados do passo "Os Seus Dados".
  const [contaDados, setContaDados] = useState<'responsavel' | 'empresa'>('responsavel');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Segurança contra bots no registo: campo-armadilha invisível (só bots que
  // preenchem tudo o caem aqui) + um desafio simples de soma.
  const [honeypot, setHoneypot] = useState('');
  const [captcha] = useState(() => ({
    a: 1 + Math.floor(Math.random() * 8),
    b: 1 + Math.floor(Math.random() * 8),
  }));
  const [captchaResposta, setCaptchaResposta] = useState('');
  // Email da conta criada neste formulário — mantém o passo "Criar Conta" na
  // lista depois de a sessão abrir (o número de passos não muda a meio) e
  // mostra-o como concluído se o cliente voltar atrás.
  const [contaCriada, setContaCriada] = useState<string | null>(null);
  // Email já com conta (e outra palavra-passe) — mostra o link para entrar.
  const [accountExists, setAccountExists] = useState(false);
  // Encomenda em curso retomada do rascunho — o passo só se decide depois de
  // se saber se há sessão ('dados' = "Editar dados" vindo do checkout).
  const [retomarPara, setRetomarPara] = useState<'dados' | 'servico' | null>(null);

  // Pré-preenche o email do responsável com o email institucional — poupa
  // reescrever o mesmo email quando é a mesma pessoa — mas fica editável.
  const handleEmailInstitucionalBlur = () => {
    if (!emailResponsavel && emailInstitucional) setEmailResponsavel(emailInstitucional);
  };

  // Serviço — lista única de linhas de encomenda; a primeira existe sempre,
  // mesmo com um só serviço, para que o cartão e a pré-visualização usem
  // sempre o mesmo formato (não há "principal" vs "adicionais").
  const categoryFor = (categoriaId: string) => CATEGORIES.find((c) => c.id === categoriaId);
  const initialCategoriaId = (() => {
    const fromQuery = searchParams.get('categoria');
    return fromQuery && CATEGORIES.some((c) => c.id === fromQuery) ? fromQuery : CATEGORIES[0].id;
  })();
  const [lineItems, setLineItems] = useState<OrderLineItem[]>(() => {
    // No painel (nova encomenda a partir de /encomendas) começa vazio — um
    // item pré-seleccionado por omissão parecia uma encomenda já existente,
    // em vez de um convite a escolher o que se quer adicionar.
    if (searchParams.get('panel') === '1') return [];
    const cat = categoryFor(initialCategoriaId);
    return [{ id: crypto.randomUUID(), categoriaId: initialCategoriaId, produto: cat?.items[0]?.name ?? '', quantidade: 1 }];
  });
  const [dataLimite, setDataLimite] = useState(() => minDeliveryDate());
  const [notas, setNotas] = useState('');

  const clearError = () => {
    setErrorMessage('');
    setStatus('idle');
  };

  const updateLineItemCategoria = (id: string, categoriaId: string) => {
    clearError();
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.id !== id) return li;
        return { ...li, categoriaId, produto: '' };
      })
    );
  };
  const updateLineItemProduto = (id: string, produto: string) => {
    clearError();
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, produto } : li)));
  };
  const updateLineItemQuantidade = (id: string, quantidade: number) => {
    clearError();
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, quantidade } : li)));
  };
  const removeLineItem = (id: string) => {
    clearError();
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((li) => li.id !== id)));
  };
  const addLineItem = () => {
    clearError();
    setLineItems((prev) => [
      { id: crypto.randomUUID(), categoriaId: '', produto: '', quantidade: 1 },
      ...prev,
    ]);
  };

  // Ao abrir o formulário: a selecção feita por checkboxes em /precos
  // (vários serviços, possivelmente de categorias diferentes — cada um vira a
  // sua própria linha) e a encomenda em curso guardada no rascunho local
  // (ver src/lib/encomenda-checkout.ts). Assim nada se perde a meio — nem ao
  // voltar atrás no browser a partir do checkout, nem ao "Editar dados" /
  // "Alterar encomenda" de lá (?retomar=1). Uma selecção nova de /precos
  // substitui só os serviços; a empresa/conta continuam as do rascunho.
  useEffect(() => {
    let selecao: OrderLineItem[] | null = null;
    const raw = sessionStorage.getItem(SELECAO_STORAGE_KEY);
    if (raw) {
      sessionStorage.removeItem(SELECAO_STORAGE_KEY);
      try {
        const items: SelectedCatalogItem[] = JSON.parse(raw);
        if (items.length) {
          selecao = items.map((item) => ({
            id: crypto.randomUUID(),
            categoriaId:
              item.categoriaId === CUSTOM_CATEGORIA_ID || CATEGORIES.some((c) => c.id === item.categoriaId)
                ? item.categoriaId
                : CATEGORIES[0].id,
            produto: item.produto,
            quantidade: 1,
          }));
          setLineItems(selecao);
        }
      } catch (e) {
        console.error('Erro ao ler selecção de /precos:', e);
      }
    }

    // O "Nova Encomenda" do painel (?panel=1) começa dos dados da última
    // encomenda, não de um rascunho — a não ser que se venha retomar um.
    const retomar = searchParams.get('retomar') === '1';
    if (!retomar && searchParams.get('panel') === '1') return;
    const draft = loadEncomendaDraft();
    if (!draft) return;
    setTipoCliente(draft.tipoCliente);
    setEmpresa(draft.empresa);
    setNif(draft.nif);
    setEndereco(draft.endereco);
    setTelefoneInstitucional(draft.telefoneInstitucional || '+258 ');
    setEmailInstitucional(draft.emailInstitucional);
    setWebsite(draft.website || 'https://');
    const dados = draft.contaDados ?? (draft.responsavel === draft.empresa ? 'empresa' : 'responsavel');
    setContaDados(dados);
    if (draft.tipoCliente === 'empresa' && dados === 'responsavel') {
      setResponsavel(draft.responsavel);
      setCargo(draft.cargo);
      setTelefoneResponsavel(draft.telefone || '+258 ');
      setEmailResponsavel(draft.email);
    }
    if (!selecao) {
      setLineItems(draft.itens.map((item) => ({ id: crypto.randomUUID(), ...item })));
      setDataLimite(draft.dataLimiteEntrega || minDeliveryDate());
      setNotas(draft.notas);
    }
    setRetomarPara(retomar && searchParams.get('passo') === 'dados' ? 'dados' : 'servico');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Com sessão (conta já criada, ou acabou de entrar) volta directo ao passo
  // "Serviço"; sem sessão (ex.: expirou) fica no "Criar Conta" para entrar
  // ou criar a conta antes de pagar. "Editar dados" abre no primeiro passo.
  useEffect(() => {
    if (!retomarPara || isAuthenticated === null) return;
    setRetomarPara(null);
    if (retomarPara === 'dados') setCurrentStep(0);
    else if (isAuthenticated) setCurrentStep(tipoCliente === 'individual' ? 1 : 2);
    else setCurrentStep(1);
  }, [retomarPara, isAuthenticated, tipoCliente]);

  // Painel de encomendas: reaproveita a empresa/responsável da encomenda mais
  // recente do próprio cliente, para não ter de os preencher outra vez.
  useEffect(() => {
    if (!isPanelEmbed || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/cotacoes');
        const data = await res.json();
        const ultima = data?.success ? data.quotations?.[0] : null;
        if (cancelled) return;
        if (ultima) {
          setEmpresa(ultima.empresa || '');
          setNif(ultima.nif || '');
          setEndereco(ultima.endereco || '');
          setTelefoneInstitucional(ultima.telefone_institucional || '+258 ');
          setEmailInstitucional(ultima.email_institucional || '');
          setWebsite(ultima.website || 'https://');
          setResponsavel(ultima.responsavel || '');
          setCargo(ultima.cargo || '');
          setTelefoneResponsavel(ultima.telefone || '+258 ');
          setEmailResponsavel(ultima.email || '');
          setTipoCliente(ultima.responsavel && ultima.responsavel === ultima.empresa ? 'individual' : 'empresa');
          return;
        }
        // Primeira encomenda de sempre — não há "última cotação" de onde
        // copiar, mas se o cliente já chegou autenticado ao painel, é porque
        // já preencheu nome/telefone/empresa algures (registo ou "O Meu
        // Perfil"). Usa isso em vez de o obrigar a repetir tudo.
        const perfilRes = await fetch('/api/encomendas/perfil');
        const perfil = perfilRes.ok ? await perfilRes.json() : null;
        if (cancelled || !perfil) return;
        const email = perfil.email || authUser?.email || '';
        if (perfil.empresa) {
          setEmpresa(perfil.empresa);
          setNif(perfil.nif || '');
          setTelefoneInstitucional(perfil.telefone || '+258 ');
          setEmailInstitucional(email);
          setResponsavel(perfil.nome || '');
          setTelefoneResponsavel(perfil.telefone || '+258 ');
          setEmailResponsavel(email);
          setTipoCliente('empresa');
        } else if (perfil.nome) {
          // Sem empresa registada — trata como pessoa singular, reaproveitando
          // o mesmo campo "empresa" para o nome, tal como acontece quando uma
          // encomenda anterior de pessoa singular é copiada (linha acima).
          setEmpresa(perfil.nome);
          setTelefoneInstitucional(perfil.telefone || '+258 ');
          setEmailInstitucional(email);
          setTipoCliente('individual');
        }
      } catch (e) {
        console.error('Erro ao pré-preencher dados da encomenda anterior:', e);
      } finally {
        if (!cancelled) setPrefillLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPanelEmbed, isAuthenticated]);

  // O passo "Criar Conta" só existe para empresa (é também o do responsável)
  // ou para quem ainda não tem sessão — trocar Empresa ↔ Particular, ou a
  // sessão mudar, pode mudar o número de passos (STEPS, mais abaixo), por
  // isso o passo actual tem de ser reancorado para não apontar para fora do
  // novo array e rebentar o render.
  const mostraPassoConta = tipoCliente === 'empresa' || isAuthenticated === false || Boolean(contaCriada);
  useEffect(() => {
    if (isPanelEmbed) {
      setCurrentStep(0);
      return;
    }
    const ultimoPasso = mostraPassoConta ? 2 : 1;
    setCurrentStep((s) => Math.min(s, ultimoPasso));
  }, [tipoCliente, isPanelEmbed, mostraPassoConta]);

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
      categoriaLabel: isCustom ? 'Pedido Personalizado' : (categoryFor(li.categoriaId)?.label ?? 'Seleccionar serviço'),
      qty: li.quantidade,
      precoUnitario: found?.item.price ?? 0,
      startingAt: Boolean(found?.item.startingAt),
      sobConsultaItem,
      subtotal,
    };
  });
  const multiTotal = multiItemsPriced.reduce((sum, i) => sum + i.subtotal, 0);
  const hasSobConsultaItem = multiItemsPriced.some((i) => i.sobConsultaItem);

  // Telefone e website vêm pré-preenchidos com o prefixo (+258 / https://)
  // — só contam como "preenchidos" quando há mesmo algo a seguir ao prefixo.
  const telefoneInstitucionalPreenchido = telefoneInstitucional.trim() !== '+258';
  const telefoneResponsavelPreenchido = telefoneResponsavel.trim() !== '+258';
  const websitePreenchido = website.trim() !== '' && website.trim() !== 'https://';

  // Separadores da pré-visualização: cada linha só aparece depois de a secção
  // imediatamente anterior ter mesmo conteúdo preenchido — nunca ficam duas
  // linhas seguidas sem nada entre elas.
  const entidadeTemDados = Boolean(empresa || endereco || telefoneInstitucionalPreenchido || emailInstitucional || nif || websitePreenchido);
  // Conta/contacto com os dados da própria empresa → não há "ponto focal" à parte.
  const usaDadosEmpresa = tipoCliente === 'individual' || contaDados === 'empresa';
  const contacto = usaDadosEmpresa
    ? { nome: empresa, cargo: '', telefone: telefoneInstitucional, email: emailInstitucional }
    : { nome: responsavel, cargo, telefone: telefoneResponsavel, email: emailResponsavel };
  const mostrarSeccaoResponsavel = tipoCliente === 'empresa' && !usaDadosEmpresa && (isPanelEmbed || currentStep >= 1);
  const responsavelTemDados = Boolean(responsavel || telefoneResponsavelPreenchido || emailResponsavel);
  const mostrarLinhaAntesServicos = mostrarSeccaoResponsavel ? responsavelTemDados : entidadeTemDados;

  if (isAuthenticated === null || (isPanelEmbed && prefillLoading) || (isEmbeddedFrame && isAuthenticated === false)) {
    return (
      <div className={isPanelEmbed ? 'flex items-center justify-center p-12' : 'min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950'}>
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  // Sem sessão (ou conta criada aqui mesmo) o passo 2 é "Criar Conta"; quem
  // já tinha sessão antes só confirma o responsável a contactar.
  const precisaCriarConta = !isAuthenticated && !contaCriada;
  const passoContaLabel = isAuthenticated && !contaCriada ? 'Responsável' : 'Criar Conta';
  const baseSteps = [
    tipoCliente === 'individual'
      ? { key: 'empresa', label: 'Os Seus Dados', icon: User }
      : { key: 'empresa', label: 'Empresa', icon: Building2 },
    ...(mostraPassoConta
      ? [{ key: 'conta', label: passoContaLabel, icon: passoContaLabel === 'Criar Conta' ? Lock : User }]
      : []),
  ];
  // No painel embutido só se salta directo para "Serviço" se já houver dados
  // institucionais de uma cotação anterior — sem isso, o pedido falhava sempre
  // com "Preencha todos os campos obrigatórios" sem o cliente ver nenhum campo
  // para corrigir (primeira cotação de sempre não tem "última" para pré-preencher).
  const hasUsableEntityData =
    tipoCliente === 'individual'
      ? Boolean(empresa && telefoneInstitucionalPreenchido && emailInstitucional)
      : Boolean(
          empresa && telefoneInstitucionalPreenchido && emailInstitucional && responsavel && telefoneResponsavelPreenchido && emailResponsavel,
        );
  const STEPS = isPanelEmbed && hasUsableEntityData
    ? [{ key: 'servico', label: 'Serviço', icon: Package }]
    : [...baseSteps, { key: 'servico', label: 'Serviço', icon: Package }];
  // currentStep pode ficar temporariamente fora dos limites no primeiro render
  // a seguir a STEPS encolher (Empresa → Particular) — o useEffect acima já o
  // reancora, mas isto evita rebentar nesse render intermédio.
  const safeStep = Math.min(currentStep, STEPS.length - 1);
  const stepKey = STEPS[safeStep].key;
  const isLastStep = safeStep === STEPS.length - 1;

  const validateStep = (key: string): string | null => {
    if (key === 'empresa') {
      if (!empresa.trim()) return tipoCliente === 'individual' ? 'Preencha o seu nome completo.' : 'Preencha o nome da empresa.';
      if (!telefoneInstitucional.trim()) return 'Preencha o contacto.';
      if (!isValidMzPhone(telefoneInstitucional)) return 'Indique um número de telefone moçambicano válido (ex: +258 84 000 0000).';
      if (!emailInstitucional.trim()) return 'Preencha o email.';
    }
    if (key === 'conta') {
      if (!usaDadosEmpresa) {
        if (!responsavel.trim()) return 'Preencha o nome do responsável.';
        if (!telefoneResponsavel.trim()) return 'Preencha o telefone do responsável.';
        if (!isValidMzPhone(telefoneResponsavel)) return 'Indique um número de telefone moçambicano válido (ex: +258 84 000 0000).';
        if (!emailResponsavel.trim()) return 'Preencha o email do responsável.';
      }
      if (precisaCriarConta) {
        if (password.length < 6) return 'A palavra-passe deve ter no mínimo 6 caracteres.';
        if (honeypot.trim()) return 'Não foi possível validar o formulário.';
        if (Number(captchaResposta) !== captcha.a + captcha.b) return 'Resposta da verificação de segurança está incorrecta.';
      }
    }
    if (key === 'servico') {
      if (lineItems.length === 0) return 'Adicione pelo menos um serviço.';
      if (lineItems.some((li) => {
        if (li.categoriaId === CUSTOM_CATEGORIA_ID) return !li.produto.trim();
        return !li.categoriaId || !li.produto || !findItem(li.categoriaId, li.produto);
      })) {
        return 'Por favor, seleccione o serviço e a especificação em todos os cartões antes de submeter o pedido.';
      }
      if (multiItemsPriced.some((i) => i.qty <= 0)) return 'Indique a quantidade de todos os serviços seleccionados.';
      if (!dataLimite) return 'Escolha a data-limite de entrega.';
    }
    return null;
  };

  // Rascunho da encomenda (ver src/lib/encomenda-checkout.ts) — o contacto
  // da encomenda é o mesmo com que a conta foi criada (responsável ou empresa).
  const buildDraft = (): Omit<EncomendaDraft, 'savedAt'> => ({
    tipoCliente,
    empresa,
    nif,
    endereco,
    telefoneInstitucional,
    emailInstitucional,
    website: websitePreenchido ? website.trim() : '',
    responsavel: contacto.nome,
    cargo: contacto.cargo,
    telefone: contacto.telefone,
    email: contacto.email || authUser?.email || '',
    contaDados: usaDadosEmpresa ? 'empresa' : 'responsavel',
    itens: lineItems.map((li) => ({ categoriaId: li.categoriaId, produto: li.produto, quantidade: li.quantidade })),
    dataLimiteEntrega: dataLimite,
    notas,
  });

  // "Já tem conta? Inicie sessão" — guarda o que já foi preenchido e volta
  // aqui (?retomar=1) depois do login, sem perder nada.
  const irParaLogin = () => {
    const registada = loadEncomendaDraft()?.registada;
    saveEncomendaDraft(registada ? { ...buildDraft(), registada } : buildDraft());
    const loginUrl = `/login?redirect=${encodeURIComponent('/cotacao?retomar=1')}`;
    const inFrame = typeof window !== 'undefined' && window.top && window.top !== window.self;
    if (inFrame) window.top!.location.href = loginUrl;
    else router.push(loginUrl);
  };

  // Cria a conta com os dados escolhidos no passo "Criar Conta" e deixa a
  // sessão aberta (o /api/auth/register já autentica no servidor). Marcada
  // como conta das encomendas: entra sempre na lista de contas das encomendas
  // do admin e o login leva-a ao painel /encomendas.
  const criarConta = async (): Promise<boolean> => {
    setIsSubmitting(true);
    setAccountExists(false);
    const email = contacto.email.trim().toLowerCase();
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          nome: contacto.nome,
          telefone: contacto.telefone,
          empresa: tipoCliente === 'empresa' ? empresa : '',
          endereco,
          honeypot,
          origem: ENCOMENDAS_ACCOUNT_ORIGIN,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status !== 409) throw new Error(data.error || 'Não foi possível criar a sua conta.');
        // Já existe conta com este email — se a palavra-passe for a mesma,
        // entra nela em vez de criar outra.
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) {
          setAccountExists(true);
          throw new Error('Já existe uma conta com este email. Inicie sessão nela para continuar a encomenda — os dados preenchidos ficam guardados.');
        }
      } else if (!data.sessionReady) {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw new Error('A conta foi criada, mas não foi possível iniciar sessão. Tente de novo.');
      }
      // Sincroniza a sessão aberta no servidor com o browser (AuthProvider).
      await supabase.auth.refreshSession();
      setContaCriada(email);
      setPassword('');
      return true;
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao comunicar com o servidor.');
      setStatus('error');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = async () => {
    if (isSubmitting) return;
    const err = validateStep(stepKey);
    if (err) {
      setErrorMessage(err);
      setStatus('error');
      return;
    }
    if (stepKey === 'conta' && precisaCriarConta && !(await criarConta())) return;
    setErrorMessage('');
    setStatus('idle');
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setErrorMessage('');
    setStatus('idle');
    setAccountExists(false);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  // "Pagar factura": a conta já existe (passo "Criar Conta") e a encomenda
  // fica num rascunho local até ser paga — segue para o checkout único (o
  // mesmo das compras de domínio/hospedagem) só para escolher o método e
  // pagar; é lá que a encomenda é submetida. Ver src/lib/encomenda-checkout.ts.
  const handlePagarFactura = async () => {
    if (isSubmitting) return;
    const err = validateStep('servico');
    if (err) {
      setErrorMessage(err);
      setStatus('error');
      return;
    }

    // Já há uma encomenda gravada no checkout (à espera do comprovativo) e o
    // cliente voltou para editar: se os dados mudaram, essa sai agora — a
    // nova é gravada ao pagar — para nunca ficarem duas. Se não mudaram, o
    // checkout continua a usar a mesma.
    const novo = buildDraft();
    let registada = loadEncomendaDraft()?.registada;
    if (registada && registada.assinatura !== encomendaDraftSignature(novo)) {
      setIsSubmitting(true);
      const descartada = await descartarEncomendaRegistada(registada.quotationId);
      setIsSubmitting(false);
      // 409: essa já tem comprovativo/está com a equipa — segue como está, e
      // esta passa a ser uma encomenda nova à parte.
      if (!descartada.ok && descartada.status !== 409) {
        setErrorMessage(descartada.error || 'Não foi possível actualizar a encomenda.');
        setStatus('error');
        return;
      }
      registada = undefined;
    }

    const saved = saveEncomendaDraft(registada ? { ...novo, registada } : novo);
    if (!saved) {
      setErrorMessage('O seu navegador bloqueou o armazenamento local — não é possível seguir para o pagamento. Active os cookies/armazenamento deste site e tente de novo.');
      setStatus('error');
      return;
    }

    // Sessão perdida pelo caminho (ex.: expirou) — volta ao passo da conta
    // para entrar de novo; o rascunho já ficou guardado acima.
    if (!isAuthenticated) {
      setCurrentStep(1);
      setAccountExists(true);
      setErrorMessage('A sua sessão terminou. Inicie sessão (ou crie a conta) para pagar a encomenda.');
      setStatus('error');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setStatus('idle');
    // Dentro do iframe "Nova Encomenda" do painel, o checkout abre na janela
    // de topo — ficar preso dentro da caixinha do iframe não faria sentido.
    const inFrame = typeof window !== 'undefined' && window.top && window.top !== window.self;
    if (inFrame) {
      window.top!.location.href = ENCOMENDA_CHECKOUT_PATH;
    } else {
      router.push(ENCOMENDA_CHECKOUT_PATH);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all text-sm';
  const labelClass = 'text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1.5 block';
  const sectionTitleClass = 'text-lg font-bold text-zinc-900 dark:text-white mb-4';

  return (
    <div className={isPanelEmbed ? 'bg-white dark:bg-zinc-950' : 'min-h-screen bg-zinc-200 dark:bg-zinc-950'}>
      {/* Banner — não faz sentido dentro do painel, só na página pública */}
      {!isPanelEmbed && (
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
      )}

      <div className={isPanelEmbed ? '' : 'bg-zinc-200 dark:bg-zinc-950'}>
        <div className={isPanelEmbed ? 'p-4' : 'container mx-auto max-w-7xl px-4 sm:px-6 pt-12 pb-16'}>
        <div className={isPanelEmbed ? '' : 'mx-5'}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Formulário em etapas */}
          <div className={isPanelEmbed ? 'lg:col-span-2 bg-white dark:bg-zinc-900 rounded-lg' : 'lg:col-span-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 sm:p-8'}>

            {/* Indicador de etapas — só um passo no painel, não vale a pena mostrar */}
            {!isPanelEmbed && (
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
            )}

            {status === 'error' && errorMessage && (
              <div className="mb-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 mt-0.5 shrink-0" />
                <div className="text-sm text-red-800 dark:text-red-300">
                  <p>{errorMessage}</p>
                  {accountExists && (
                    <button
                      type="button"
                      onClick={irParaLogin}
                      className="inline-flex items-center gap-1 mt-2 font-bold underline hover:no-underline"
                    >
                      Entrar na minha conta <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
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
                    <input type="email" className={inputClass} value={emailInstitucional} onChange={(e) => setEmailInstitucional(e.target.value)} onBlur={handleEmailInstitucionalBlur} required />
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

            {stepKey === 'conta' && (
              <>
                <h2 className={sectionTitleClass}>{passoContaLabel === 'Criar Conta' ? 'Criar Conta' : 'Responsável a Contactar'}</h2>

                {precisaCriarConta && (
                  <p className="-mt-2 mb-5 text-sm text-zinc-600 dark:text-zinc-400">
                    Já tem conta?{' '}
                    <button type="button" onClick={irParaLogin} className="font-bold text-red-600 dark:text-red-500 hover:underline">
                      Inicie sessão
                    </button>{' '}
                    — os dados que já preencheu ficam guardados.
                  </p>
                )}

                {tipoCliente === 'empresa' && (
                  <div className="mb-5">
                    <label className={labelClass}>
                      {passoContaLabel === 'Criar Conta' ? 'Criar a conta com os dados de' : 'Contacto da encomenda'}
                    </label>
                    <div className="flex items-center gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-md w-fit">
                      {(['responsavel', 'empresa'] as const).map((opcao) => (
                        <button
                          key={opcao}
                          type="button"
                          onClick={() => setContaDados(opcao)}
                          className={`px-4 py-1.5 rounded text-sm font-bold transition-colors ${
                            contaDados === opcao ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {opcao === 'responsavel' ? 'Responsável' : 'Empresa'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {usaDadosEmpresa ? (
                  <div className="mb-5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 text-sm space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">
                      {passoContaLabel === 'Criar Conta' ? 'A conta fica com estes dados' : 'Contacto'}
                    </p>
                    <p><span className="font-bold text-zinc-900 dark:text-white">Nome: </span><span className="text-zinc-600 dark:text-zinc-300">{empresa}</span></p>
                    <p><span className="font-bold text-zinc-900 dark:text-white">Email: </span><span className="text-zinc-600 dark:text-zinc-300">{emailInstitucional}</span></p>
                    <p><span className="font-bold text-zinc-900 dark:text-white">Telefone: </span><span className="text-zinc-600 dark:text-zinc-300">{telefoneInstitucional}</span></p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className={labelClass}>Nome do Responsável</label>
                      <input className={inputClass} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} required />
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
                      <label className={labelClass}>{precisaCriarConta ? 'Email do Responsável (email da conta)' : 'Email do Responsável'}</label>
                      <input type="email" className={inputClass} value={emailResponsavel} onChange={(e) => setEmailResponsavel(e.target.value)} required />
                    </div>
                  </div>
                )}

                {precisaCriarConta && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Palavra-passe (mín. 6 caracteres)</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          className={`${inputClass} pr-10`}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                          aria-label={showPassword ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Verificação — quanto é {captcha.a} + {captcha.b}?</label>
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
                )}

                {contaCriada && (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20 p-3 text-sm text-green-800 dark:text-green-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Conta criada com o email <strong>{contaCriada}</strong> — já tem sessão iniciada.</span>
                  </div>
                )}
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
                  {lineItems.length === 0 && (
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="w-full flex flex-col items-center justify-center gap-2 p-8 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-red-400 hover:text-red-600 dark:hover:text-red-500 transition-colors"
                    >
                      <Plus className="w-6 h-6" />
                      <span className="text-sm font-bold">Adicionar serviço</span>
                    </button>
                  )}
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
                                ref={(el) => {
                                  // Ajusta a altura ao conteúdo actual mesmo quando o texto chega
                                  // por outra via que não seja digitação (ex.: restaurado de /precos),
                                  // não só ao digitar/focar.
                                  if (el) {
                                    el.style.height = 'auto';
                                    el.style.height = `${el.scrollHeight}px`;
                                  }
                                }}
                                value={li.produto}
                                onChange={(e) => {
                                  updateLineItemProduto(li.id, e.target.value);
                                  e.target.style.height = 'auto';
                                  e.target.style.height = `${e.target.scrollHeight}px`;
                                }}
                                onFocus={(e) => {
                                  e.target.style.height = 'auto';
                                  e.target.style.height = `${e.target.scrollHeight}px`;
                                }}
                                rows={2}
                                className="w-full bg-transparent text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none resize-y min-h-[60px] p-2 border border-zinc-200 dark:border-zinc-800 rounded-md transition-all"
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
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-sm"
                        >
                          <div className="flex-1 min-w-0 space-y-1 sm:mr-[200px] mr-4">
                            {/* Nome do Serviço / Categoria (ex: Cartões de Visita - em destaque, visível e negrito no topo) */}
                            <div className="relative flex items-center max-w-full">
                              <select
                                value={li.categoriaId}
                                onChange={(e) => updateLineItemCategoria(li.id, e.target.value)}
                                className={`w-full appearance-none bg-transparent text-sm cursor-pointer focus:outline-none truncate pr-6 ${li.categoriaId ? 'font-bold text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500 italic font-medium'}`}
                              >
                                {!li.categoriaId && <option value="">Seleccionar serviço</option>}
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
                              <ChevronDown className="w-4 h-4 text-zinc-500 dark:text-zinc-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>

                            {/* Descrição / Tipo de Papel / Especificação (letras pequenas em baixo) */}
                            <div className="relative flex items-center max-w-full">
                              <select
                                value={li.produto}
                                onChange={(e) => updateLineItemProduto(li.id, e.target.value)}
                                className={`w-full appearance-none bg-transparent text-xs cursor-pointer focus:outline-none truncate pr-6 ${li.produto ? 'text-zinc-600 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-500 italic'}`}
                              >
                                {!li.produto && <option value="">Seleccionar especificação</option>}
                                {(cat?.items ?? []).map((p) => (
                                  <option key={p.name} value={p.name}>
                                    {p.name}
                                    {p.sobConsulta ? ' (Sob Consulta)' : p.startingAt ? ` (a partir de ${formatMt(p.price)} MT)` : ''}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                    {isLastStep && (
                      <div className="flex items-start gap-1.5 mt-2">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-600 dark:text-red-500 italic leading-relaxed">
                          A entrega pretendida é até {dataLimite ? new Date(dataLimite).toLocaleDateString('pt-PT') : '—'}, com prazo mínimo de execução de 7 dias úteis.{' '}
                          {multiTotal > 0
                            ? `Para dar início à produção, é necessário adiantar 70% do valor total da factura: ${formatMt(multiTotal * 1.16 * 0.7)} MT.${hasSobConsultaItem ? ' Os serviços Sob Consulta são confirmados por contacto à parte.' : ''}`
                            : 'Estes serviços são Sob Consulta — entraremos em contacto para confirmar o valor e as condições de pagamento.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Navegação entre etapas — no painel só há o passo "Serviço", não
                há "Voltar" nem "Seguinte" para mostrar, por isso nem a faixa
                (borda + espaço) faz sentido aparecer vazia. */}
            {!isPanelEmbed && (
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
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold px-6 py-2.5 rounded-md text-sm hover:opacity-90 disabled:opacity-60 transition-opacity"
                  >
                    {isSubmitting ? <Spinner className="w-4 h-4" /> : null}
                    <span>
                      {stepKey === 'conta' && precisaCriarConta
                        ? isSubmitting ? 'A criar a conta...' : 'Criar conta e continuar'
                        : 'Seguinte'}
                    </span>
                    {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                  </button>
                </>
              )}
            </div>
            )}
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
                  {telefoneInstitucionalPreenchido && <p><span className="font-bold text-zinc-900 dark:text-white">Contacto: </span><span className="text-zinc-600 dark:text-zinc-300">{telefoneInstitucional}</span></p>}
                  {emailInstitucional && <p><span className="font-bold text-zinc-900 dark:text-white">E-mail: </span><span className="text-zinc-600 dark:text-zinc-300">{emailInstitucional}</span></p>}
                  {nif && <p><span className="font-bold text-zinc-900 dark:text-white">Nuit: </span><span className="text-zinc-600 dark:text-zinc-300">{nif}</span></p>}
                  {websitePreenchido && <p><span className="font-bold text-zinc-900 dark:text-white">Website: </span><span className="text-zinc-600 dark:text-zinc-300">{website}</span></p>}
                </div>

                {mostrarSeccaoResponsavel && (
                  <div className="space-y-1 text-sm">
                    <h4 className="text-sm font-bold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 pb-1.5 mb-1.5 border-b border-zinc-300 dark:border-zinc-600">Responsável</h4>
                    {responsavel && <p><span className="font-bold text-zinc-900 dark:text-white">Ponto focal: </span><span className="text-zinc-600 dark:text-zinc-300">{responsavel}{cargo ? ` — ${cargo}` : ''}</span></p>}
                    {telefoneResponsavelPreenchido && <p><span className="font-bold text-zinc-900 dark:text-white">Contacto: </span><span className="text-zinc-600 dark:text-zinc-300">{telefoneResponsavel}</span></p>}
                    {emailResponsavel && <p><span className="font-bold text-zinc-900 dark:text-white">E-mail: </span><span className="text-zinc-600 dark:text-zinc-300">{emailResponsavel}</span></p>}
                  </div>
                )}

                <div className={`space-y-3 text-sm ${mostrarLinhaAntesServicos ? 'border-t border-zinc-300 dark:border-zinc-600 pt-4' : ''}`}>
                  {multiItemsPriced.map(({ li, categoriaLabel, qty, sobConsultaItem, isCustom, precoUnitario, startingAt }) => (
                    <div key={li.id}>
                      {isCustom ? (
                        <>
                          <p className="font-semibold text-zinc-900 dark:text-white">{categoriaLabel}</p>
                          <p className="text-zinc-500 dark:text-zinc-400">{li.produto}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-zinc-900 dark:text-white">{categoriaLabel}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{li.produto}</p>
                        </>
                      )}
                      {isCustom ? null : sobConsultaItem ? (
                        <p className="text-sm font-bold text-red-600 dark:text-red-500 mt-0.5">Sob Consulta</p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-zinc-500 dark:text-zinc-400">Quantidade</span>
                            <span className="text-zinc-800 dark:text-zinc-200">{qty}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-500 dark:text-zinc-400">V. Unitário{startingAt ? ' (estimativa)' : ''}</span>
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">{startingAt ? 'a partir de ' : ''}{formatMt(precoUnitario)} MT</span>
                          </div>
                          {startingAt && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              Valor estimado — a equipa confirma o valor final consoante o âmbito do trabalho.
                            </p>
                          )}
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
                      onClick={handlePagarFactura}
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-md transition-all shadow-lg shadow-red-600/20 text-sm"
                    >
                      {isSubmitting ? (
                        <>
                          <Spinner className="w-4 h-4" />
                          <span>A abrir o pagamento...</span>
                        </>
                      ) : (
                        <>
                          {/* Só Sob Consulta: não há valor a pagar ainda — segue
                              para o checkout só para confirmar conta e pedido. */}
                          <span>{multiTotal > 0 ? 'Pagar factura' : 'Continuar'}</span>
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
          <Spinner className="w-10 h-10" />
        </div>
      }
    >
      <CotacaoContent />
    </Suspense>
  );
}
