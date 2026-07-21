'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { NotchSection } from '@/components/home/NotchSection'
import { BudgetRequestModal } from '@/components/forms/BudgetRequestModal'
import { 
  Award, 
  Users, 
  Sparkles, 
  Target, 
  ShieldCheck, 
  ArrowRight,
  TrendingUp,
  HeartHandshake,
  Cpu
} from 'lucide-react'

export default function AboutPage() {
  const { t } = useI18n()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const stats = [
    { value: '14 Anos', label: 'Inovação Contínua', desc: 'Desde 2012 no mercado', icon: Award },
    { value: '+150', label: 'Marcas Parceiras', desc: 'Clientes satisfeitos', icon: Users },
    { value: '+30', label: 'Especialidades', desc: 'Serviços integrados', icon: Sparkles },
    { value: '100%', label: 'Disponibilidade', desc: 'Suporte especializado', icon: ShieldCheck },
  ]

  const timelineSteps = [
    {
      year: '2012',
      title: 'A Fundação',
      subtitle: 'Branding e Design Gráfico',
      desc: 'Nascimento da VisualDESIGN Services, Lda. com o propósito de transformar a imagem corporativa no mercado moçambicano.'
    },
    {
      year: '2016',
      title: 'Expansão Web',
      subtitle: 'Inovação e Desenvolvimento',
      desc: 'Integração de serviços de engenharia de software, respondendo à crescente procura por websites e plataformas interativas.'
    },
    {
      year: '2021',
      title: 'Consolidação',
      subtitle: 'Suporte a Grandes Marcas',
      desc: 'Consolidação da liderança em campanhas integradas de branding, eventos corporativos de grande porte e TI.'
    },
    {
      year: '2026',
      title: 'Segurança & IA',
      subtitle: 'O Futuro Hoje',
      desc: 'Lançamento de sistemas integrados de monitorização de marcas, aplicações de autenticidade (QR/NFC) e inteligência artificial.'
    }
  ]

  const teamMembers = [
    {
      name: 'Silva Chamo',
      role: 'Lead UX/UI & Front-end',
      initials: 'SC',
      desc: 'Formação em Comunicação pela Escola Superior de Jornalismo. Mestre do design de interfaces e prototipagem interativa avançada.'
    },
    {
      name: 'Raul Macamo',
      role: 'Content & Product Communications',
      initials: 'RM',
      desc: 'Jornalista de formação com ampla experiência em gestão de conteúdos, comunicação estratégica e conformidade corporativa.'
    },
    {
      name: 'Zacarias Maganda',
      role: 'Lead Back-end & Infraestrutura',
      initials: 'ZM',
      desc: 'Licenciado em Engenharia Informática. Especialista em desenho de APIs robustas de alto débito e orquestração em nuvem.'
    },
    {
      name: 'Evaristo Maússe',
      role: 'Engenharia Mobile & QA',
      initials: 'EM',
      desc: 'Formação em Jornalismo e especialista certificado em manutenção. Desenvolvedor de apps móveis e gestor de qualidade de software.'
    }
  ]

  const values = [
    {
      title: 'Consistência de Marca',
      desc: 'Para nós, uma marca é uma narrativa consistente que exige protecção e coerência operacional em cada ponto de contacto.',
      icon: HeartHandshake,
      badge: 'Marca'
    },
    {
      title: 'Inovação & Tecnologia',
      desc: 'Aliamos inteligência de design a competências tecnológicas robustas (AI, Web, Mobile) para criar ferramentas seguras.',
      icon: Cpu,
      badge: 'Engenharia'
    },
    {
      title: 'Usabilidade Real',
      desc: 'Desenvolvemos soluções com metodologias colaborativas orientadas a resultados práticos e usabilidade total no dia a dia.',
      icon: TrendingUp,
      badge: 'Foco'
    },
    {
      title: 'Segurança & Rigor',
      desc: 'Padrões de segurança rigorosos, criptografia avançada e processos robustos para garantir integridade permanente.',
      icon: ShieldCheck,
      badge: 'Confiança'
    }
  ]

  return (
    <div className="min-h-screen bg-black/10 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans selection:bg-red-500 selection:text-white">
      
      {/* Hero Section Standardized */}
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10 text-center">
          <div>
            <div className="text-xs sm:text-sm text-zinc-400 font-bold uppercase tracking-widest mb-2">
              Início / Sobre Nós
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Sobre a VisualDesign</h1>
            <p className="text-base sm:text-lg text-zinc-300 font-normal max-w-2xl mx-auto leading-relaxed">
              Conheça a nossa história, a nossa equipa de especialistas e os valores que guiam o nosso trabalho.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Counter Bar - Match VisualWeb color sections */}
      <NotchSection shape="mid" bg="bg-white dark:bg-zinc-950" className="py-14 border-b border-zinc-200/50 dark:border-white/5">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, idx) => {
              const Icon = stat.icon
              return (
                <div key={idx} className="flex flex-col items-center lg:items-start text-center lg:text-left p-2 group">
                  <div className="text-red-500 mb-3 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white tracking-tight">
                    {stat.value}
                  </span>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 font-extrabold uppercase tracking-wider mt-2">
                    {stat.label}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">
                    {stat.desc}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </NotchSection>

      {/* A Nossa História & Missão - bg-zinc-200 dark:bg-black matching VisualWeb */}
      <NotchSection shape="mid-alt" bg="bg-zinc-200 dark:bg-black" className="py-28 relative">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
            
            {/* Esquerda - História */}
            <div className="lg:col-span-7 space-y-8 text-left">
              <span className="text-xs font-bold uppercase tracking-widest text-red-500 block">
                Trajetória de Sucesso
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight">
                Design com Estratégia, <br />
                Tecnologia com Rigor.
              </h2>
              <div className="h-1 w-20 bg-gradient-to-r from-red-600 to-rose-400 rounded-full" />
              <div className="space-y-6 text-zinc-600 dark:text-zinc-400 text-base leading-relaxed font-normal">
                <p>
                  A VisualDESIGN Services é uma empresa moçambicana especializada em soluções digitais de comunicação e imagem, com uma equipa multidisciplinar composta por profissionais de design, desenvolvimento de software e ciência de dados. A nossa experiência abrange o desenvolvimento de plataformas web e mobile, integração de sistemas de monitorização digital e implementação de soluções de análise de dados.
                </p>
                <p>
                  Trabalhamos com metodologias orientadas a resultados, privilegiando abordagens colaborativas com os nossos parceiros para garantir soluções práticas, sustentáveis e fáceis de gerir. A nossa equipa alia sensibilidade estratégica de marca a competências técnicas robustas, garantindo entregas com foco em usabilidade, segurança e escalabilidade.
                </p>
              </div>
            </div>

            {/* Direita - Missão Container - bg-white dark:bg-zinc-950 */}
            <div className="lg:col-span-5 relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-rose-500 rounded-3xl blur opacity-15 dark:opacity-25 group-hover:opacity-35 transition duration-1000" />
              <div className="relative bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 p-10 rounded-3xl text-left space-y-8 shadow-sm">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/30 text-red-500">
                  <Target className="w-6 h-6" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-black text-zinc-900 dark:text-white">Nossa Missão</h3>
                  <p className="text-zinc-700 dark:text-zinc-300 text-lg leading-relaxed italic font-medium">
                    "Impulsionar o sucesso dos nossos parceiros através de soluções integradas de design, branding e tecnologia de ponta, tornando a sua presença digital e física memorável, consistente e segura."
                  </p>
                </div>
                <div className="border-t border-zinc-100 dark:border-zinc-900 pt-6">
                  <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-2">Abordagem Criativa</span>
                  <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed">
                    Para nós, a marca é uma narrativa consistente que comunica qualidade e confiança em todos os pontos de contacto operacionais e digitais.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </NotchSection>

      {/* Marcos Cronologia - bg-white dark:bg-zinc-950 */}
      <NotchSection shape="mid" bg="bg-white dark:bg-zinc-950" className="py-28">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <span className="text-xs font-bold uppercase tracking-widest text-red-500 block">
              Marcos Históricos
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-zinc-900 dark:text-white tracking-tight">
              A Nossa Jornada desde 2012
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base max-w-xl mx-auto">
              Como evoluímos de um estúdio de design criativo para uma agência integrada de design de marca e soluções digitais avançadas.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {timelineSteps.map((step, idx) => (
              <div 
                key={idx} 
                className="relative bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 p-8 rounded-3xl flex flex-col justify-between min-h-[300px] hover:border-red-500/40 transition-colors duration-500 group shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <span className="text-5xl font-black text-red-500 group-hover:text-red-400 transition-colors">
                    {step.year}
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 group-hover:scale-125 transition-transform duration-300" />
                </div>

                <div className="space-y-3 mt-8 text-left">
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest block">
                    {step.subtitle}
                  </span>
                  <h4 className="font-extrabold text-xl text-zinc-900 dark:text-white">
                    {step.title}
                  </h4>
                  <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </NotchSection>

      {/* Equipa de Especialistas - bg-zinc-200 dark:bg-black */}
      <NotchSection shape="mid-alt" bg="bg-zinc-200 dark:bg-black" className="py-28 relative">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start mb-20">
            <div className="lg:col-span-5 text-left space-y-4">
              <span className="text-xs font-bold uppercase tracking-widest text-red-500 block">
                Os Especialistas
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-zinc-900 dark:text-white tracking-tight">
                A Equipa de Engenharia & Design
              </h2>
            </div>
            <div className="lg:col-span-7 text-left flex items-center h-full">
              <p className="text-zinc-500 dark:text-zinc-400 text-base sm:text-lg leading-relaxed font-normal">
                Uma equipa multidisciplinar de engenharia informática, design gráfico de ponta, jornalismo e gestão de comunicação, focada na excelência e em resultados tangíveis.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            {teamMembers.map((member, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-6 py-8 border-b border-zinc-300 dark:border-zinc-800 group hover:border-red-500/40 transition-colors duration-500"
              >
                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 flex items-center justify-center font-black text-zinc-700 dark:text-zinc-300 text-lg group-hover:text-red-500 group-hover:border-red-500/30 transition-all duration-300 shrink-0 shadow-sm">
                  {member.initials}
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest block">
                    {member.role}
                  </span>
                  <h4 className="font-extrabold text-2xl text-zinc-900 dark:text-white group-hover:translate-x-1 transition-transform duration-300">
                    {member.name}
                  </h4>
                  <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-md">
                    {member.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </NotchSection>

      {/* Valores Corporativos - bg-white dark:bg-zinc-950 */}
      <NotchSection shape="mid" bg="bg-white dark:bg-zinc-950" className="py-28">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
            <span className="text-xs font-bold uppercase tracking-widest text-red-500 block">
              Os Pilares
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-zinc-900 dark:text-white tracking-tight">
              Valores Fundamentais
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-left">
            {values.map((val, idx) => {
              const Icon = val.icon
              return (
                <div key={idx} className="relative group pl-6 border-l border-zinc-200 dark:border-zinc-800 hover:border-red-500 transition-colors duration-500 space-y-4">
                  <div className="text-red-500 w-fit">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <span className="inline-block bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/20 text-red-500 font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {val.badge}
                    </span>
                    <h4 className="font-extrabold text-zinc-900 dark:text-white text-lg tracking-tight">
                      {val.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal">
                      {val.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </NotchSection>

      {/* CTA Footer Section - bg-zinc-200 dark:bg-black */}
      <NotchSection shape="end" bg="bg-zinc-200 dark:bg-black" className="py-28">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="relative overflow-hidden bg-gradient-to-r from-red-50/20 dark:from-red-950/20 to-zinc-200/50 dark:to-zinc-900/10 border border-red-200 dark:border-red-500/20 py-20 px-8 sm:px-16 rounded-3xl text-center space-y-8 shadow-sm">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-red-500/5 dark:bg-red-500/10 rounded-full blur-[90px] pointer-events-none" />
            
            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h2 className="text-3xl sm:text-5xl font-black text-zinc-900 dark:text-white leading-tight">Precisa de uma Proposta Personalizada?</h2>
              <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-300 max-w-xl mx-auto leading-relaxed">
                Fale connosco hoje mesmo e solicite um orçamento detalhado ajustado às necessidades de branding e desenvolvimento da sua empresa.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-10 py-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer text-sm tracking-wider uppercase"
              >
                <span>Pedir Orçamento Gratuito</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </NotchSection>

      {/* Budget Modal */}
      <BudgetRequestModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialService="design-grafico"
      />

    </div>
  )
}
