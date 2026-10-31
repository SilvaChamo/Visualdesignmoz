import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronRight,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Info,
  Globe,
  Shield,
  RefreshCw,
  Trash2,
  Tag,
  ArrowRightLeft,
  RotateCcw,
  Users,
  Languages,
  Star,
  Sparkles,
} from 'lucide-react';
import { NotchSection } from '@/components/home/NotchSection';

export const metadata: Metadata = {
  title: 'Como Transferir um Domínio | Ajuda VisualDesign',
  description:
    'Guia completo sobre os passos envolvidos no processo de transferência de domínio — preparação, código EPP e próximos passos.',
};

// ── Menu lateral ────────────────────────────────────────────────────────────

const SIDEBAR_ITEMS = [
  { label: 'Definições', href: '/ajuda/dominios/definicoes', icon: Globe },
  { label: 'Privacidade', href: '/ajuda/dominios/privacidade', icon: Shield },
  { label: 'Registro', href: '/ajuda/dominios/registro', icon: BookOpen },
  { label: 'Exclusão em Grace', href: '/ajuda/dominios/exclusao-grace', icon: Trash2 },
  { label: 'Marcar para Exclusão', href: '/ajuda/dominios/marcar-exclusao', icon: Tag },
  { label: 'Transferir', href: '/ajuda/dominios/transferir', icon: ArrowRightLeft, active: true },
  { label: 'Renovação', href: '/ajuda/dominios/renovacao', icon: RefreshCw },
  { label: 'Restaurar', href: '/ajuda/dominios/restaurar', icon: RotateCcw },
  { label: 'Mudanças de Propriedade', href: '/ajuda/dominios/propriedade', icon: Users },
  { label: 'Nomes de Domínio Internacionalizados (IDNs)', href: '/ajuda/dominios/idns', icon: Languages },
  { label: 'Domínios Premium', href: '/ajuda/dominios/premium', icon: Star },
  { label: 'Novos TLDs', href: '/ajuda/dominios/novos-tlds', icon: Sparkles },
];

// ── Componente: Item de menu ────────────────────────────────────────────────

function SidebarItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${active
        ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
        : 'text-gray-700 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800/60'
        }`}
    >
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${active
          ? 'text-blue-500 dark:text-blue-400'
          : 'text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-400'
          }`}
      />
      {label}
    </Link>
  );
}

// ── Página ──────────────────────────────────────────────────────────────────

export default function TransferirDominioPage() {
  return (
    <>
      {/* ── Banner Hero com efeito NotchSection (recorte em baixo) ─────── */}
      <NotchSection shape="start" bg="bg-zinc-900 dark:bg-zinc-950" first className="z-10">
        {/* Fundo decorativo */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-zinc-900/60 to-zinc-900/80" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Container com espaço reservado para o menu fixo (~113px), como nos outros banners do site */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-5 sm:px-6 pt-[150px] pb-[80px] flex flex-col items-center text-center">
          {/* Ícone */}
          <div className="h-14 w-14 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-5">
            <ArrowRightLeft className="h-6 w-6 text-blue-400" />
          </div>

          {/* Título */}
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight mb-5">
            Como Transferir Domínio
          </h1>

          {/* Breadcrumb */}
          <nav className="flex items-center justify-center gap-1.5 text-xs text-zinc-400">
            <Link href="/ajuda" className="hover:text-white transition-colors">
              Ajuda
            </Link>
            <ChevronRight className="h-3 w-3 text-zinc-600" />
            <Link href="/ajuda/dominios" className="hover:text-white transition-colors">
              Domínios
            </Link>
            <ChevronRight className="h-3 w-3 text-zinc-600" />
            <span className="text-white font-medium">Transferir</span>
          </nav>
        </div>
      </NotchSection>

      {/* ── Conteúdo da página ─────────────────────────────────────────── */}
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 pb-20">
        <div className="max-w-7xl mx-auto px-9 sm:px-11 pt-10">
          <div className="flex gap-6 items-start">

            {/* ── Sidebar ──────────────────────────────────────────────── */}
            <aside className="hidden lg:block w-64 shrink-0 sticky top-[88px]">
              <div className="rounded-lg border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
                {/* Cabeçalho da categoria */}
                <div className="flex items-center justify-between px-4 py-3.5 text-sm font-bold text-gray-900 dark:text-zinc-100 bg-gray-50 dark:bg-zinc-800/60 border-b border-gray-200 dark:border-zinc-800">
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Domínios
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>

                {/* Itens do menu */}
                <nav className="p-2 space-y-0.5">
                  {SIDEBAR_ITEMS.map((item) => (
                    <SidebarItem key={item.href} {...item} />
                  ))}
                </nav>
              </div>
            </aside>

            {/* ── Conteúdo principal ───────────────────────────────────── */}
            <main className="flex-1 min-w-0">
              <article className="rounded-lg border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 sm:p-8">

                {/* Cabeçalho do artigo */}
                <header className="border-b border-gray-100 dark:border-zinc-800 pb-6 mb-6">
                  <h2 className="text-xl sm:text-4xl font-extrabold text-gray-900 dark:text-zinc-100 leading-tight">
                    Quais são os passos envolvidos no processo de transferência de domínio?
                  </h2>
                  <div className="flex items-center gap-4 mt-2 text-[14px] text-gray-500 dark:text-zinc-500">
                    <span>Atualizado: 2026/08/11</span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      Visto 52 448 vezes
                    </span>
                  </div>
                </header>

                {/* Introdução */}
                <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-8">
                  Há algumas etapas de preparação que recomendamos fazer antes de iniciar o processo de
                  transferência de domínio, seguido pelos{' '}
                  <strong className="font-semibold text-gray-800 dark:text-zinc-200">&quot;próximos passos&quot;</strong>{' '}
                  descritos abaixo.
                </p>

                {/* ── Passos de Preparação ─────────────────────────────── */}
                <section className="mb-8">
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    </span>
                    Passos de Preparação
                  </h3>

                  <ol className="space-y-4">
                    {[
                      {
                        title: 'Verifique os 60 dias de antiguidade',
                        body: 'Certifique-se de que seu domínio tenha mais de 60 dias, ou seja, tenha sido registrado há mais de 60 dias e não tenha sido transferido nos últimos 60 dias.',
                      },
                      {
                        title: 'Não deixe o domínio expirar durante o processo',
                        body: 'Certifique-se de que seu domínio não esteja prestes a expirar. Embora a transferência possa ser concluída mesmo que seu domínio expire durante o processo, não há garantia de que isso aconteça. Recomendamos iniciar a transferência do domínio pelo menos 2 semanas antes da data de expiração.',
                      },
                      {
                        title: 'Email Whois correto e acessível',
                        body: 'Verifique novamente se o seu Endereço de email Whois é exacto e acessível. Certas transferências de TLD podem exigir que receba um código de autorização ou envie e-mails de verificação por este endereço. Se não estiver correto, deve actualizar o seu e-mail Whois antes da transferência.',
                      },
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3.5">
                        <span className="h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-0.5">{item.title}</p>
                          <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">{item.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                {/* ── Próximos Passos ──────────────────────────────────── */}
                <section className="mb-8">
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-teal-100 dark:bg-teal-950/40 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    </span>
                    Próximos Passos
                  </h3>

                  <ol className="space-y-4">
                    {[
                      {
                        title: 'Obtenha o código de autorização (EPP)',
                        body: 'Desbloqueie seu domínio e obtenha o código de autorização (também conhecido como código EPP) do seu registrador atual.',
                      },
                      {
                        title: 'Submeta o pedido de transferência',
                        body: 'Forneça o código de autorização e envie um pedido de transferência de domínio para o(s) domínio(s) com o novo registrador (também oferecemos transferências em massa).',
                      },
                      {
                        title: 'Aguarde a confirmação do registrador atual',
                        body: 'Depois que a transferência for iniciada, pode levar algum tempo para que o registrador atual seja notificado. A maioria dos registradores exige que o titular do domínio confirme a transferência antes de liberar o(s) domínio(s). Certifique-se de verificar quaisquer notificações do registrador atual e tome as medidas necessárias prontamente.',
                      },
                      {
                        title: 'Conclusão da transferência',
                        body: 'Depois que o registrar de origem libere o(s) domínio(s), o registro central mudará o registrador para o registrador de destino e a transferência será concluída.',
                      },
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3.5">
                        <span className="h-6 w-6 rounded-full bg-teal-100 dark:bg-teal-950/40 flex items-center justify-center text-xs font-bold text-teal-700 dark:text-teal-400 shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-0.5">{item.title}</p>
                          <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">{item.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  {/* Prazo */}
                  <div className="mt-5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/40 px-4 py-3">
                    <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
                      <strong className="font-semibold">As transferências podem levar de 1 a 15 dias</strong>, dependendo
                      da rapidez com que cada etapa pode ser concluída.
                    </p>
                  </div>
                </section>

                {/* ── NOTA ─────────────────────────────────────────────── */}
                <section>
                  <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="text-sm font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                        Nota
                      </span>
                    </div>

                    <ul className="space-y-3 text-sm text-blue-800 dark:text-blue-300">
                      <li className="flex items-start gap-2">
                        <span className="shrink-0 font-bold mt-0.5">•</span>
                        <span>
                          <strong className="font-semibold">Preços de Transferência &amp; Promoções:</strong>{' '}
                          Recomendamos revisar nossa Lista de Preços de Transferência de TLD e verificar nossas promoções
                          mensais para quaisquer descontos ou ofertas especiais disponíveis.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="shrink-0 font-bold mt-0.5">•</span>
                        <span>
                          <strong className="font-semibold">Extensão de Expiração:</strong> Na maioria dos casos,
                          transferir um domínio estenderá automaticamente sua data de expiração em um ano. Exceções podem
                          ser aplicadas.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="shrink-0 font-bold mt-0.5">•</span>
                        <span>
                          <strong className="font-semibold">Preocupações com indisponibilidade do site/e-mail:</strong>{' '}
                          Entre em contacto com o nosso suporte para mais informações sobre como garantir a continuidade
                          do serviço durante a transferência.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* CTA de suporte */}
                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <p className="text-sm text-gray-500 dark:text-zinc-500">
                    Ainda tem dúvidas sobre a transferência?
                  </p>
                  <Link
                    href="/contacto"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline underline-offset-2"
                  >
                    Falar com o suporte
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

              </article>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
