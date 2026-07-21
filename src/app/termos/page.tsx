'use client'


export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 transition-colors duration-200">
      {/* Hero Section */}
      <div className="bg-[#404040] relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10"
          style={{ backgroundImage: "url('/assets/BG.jpg')" }}
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="container mx-auto max-w-7xl px-6 pt-[140px] pb-[60px] flex items-center justify-center min-h-[260px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Termos e Condições</h1>
            <p className="text-sm text-zinc-300 font-medium max-w-2xl mx-auto">
              Regras e diretrizes para a utilização dos serviços e plataformas da VisualDesign.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-16">
        <div className="container mx-auto max-w-4xl px-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-white/5 p-8 sm:p-12 rounded-2xl shadow-sm space-y-8 text-zinc-700 dark:text-zinc-300">
            
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">1. Aceitação dos Termos</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Ao aceder e utilizar o website ou quaisquer serviços prestados pela VisualDesign, o utilizador concorda em cumprir e estar vinculado aos seguintes Termos e Condições de Serviço. Se não concordar com qualquer parte destes termos, não deverá utilizar os nossos serviços.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">2. Serviços Prestados</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                A VisualDesign desenvolve soluções na área de design gráfico, desenvolvimento web, marketing digital, produção de vídeo, eventos corporativos, alojamento web e registo de domínios. Cada serviço pode estar sujeito a contratos adicionais ou acordos de nível de serviço específicos.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">3. Propriedade Intelectual</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Todos os conteúdos, marcas registadas, logótipos, designs, códigos fonte e materiais criados pela VisualDesign são propriedade exclusiva da nossa empresa ou dos respetivos licenciadores, sendo protegidos pelas leis de propriedade intelectual vigentes em Moçambique e tratados internacionais.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">4. Obrigações e Conduta do Utilizador</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                O utilizador compromete-se a fornecer informações verdadeiras e atualizadas nas comunicações e registos no site. É expressamente proibido o uso de nossos sistemas para fins ilícitos, envio de SPAM, distribuição de vírus ou qualquer atividade que possa comprometer a integridade das plataformas da VisualDesign.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">5. Limitação de Responsabilidade</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Em nenhuma circunstância a VisualDesign será responsável por danos indiretos, incidentais ou consequenciais decorrentes da interrupção temporária de serviços de alojamento, falhas de rede de terceiros ou actualizações técnicas necessárias para a segurança e estabilidade dos sistemas.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">6. Legislação Aplicável e Jurisdição</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Estes termos são regidos pelas leis da República de Moçambique. Qualquer litígio emergente da interpretação ou execução deste acordo será submetido ao foro competente da Cidade de Maputo.
              </p>
            </section>

            <div className="pt-6 border-t border-zinc-100 dark:border-white/5 text-xs text-zinc-400 text-center">
              Última actualização: Julho de 2026.
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
