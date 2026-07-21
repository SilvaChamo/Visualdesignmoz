'use client'


export default function PrivacyPage() {
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
            <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Política de Privacidade</h1>
            <p className="text-sm text-zinc-300 font-medium max-w-2xl mx-auto">
              Saiba como a VisualDesign recolhe, utiliza e protege os seus dados pessoais.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-16">
        <div className="container mx-auto max-w-4xl px-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-white/5 p-8 sm:p-12 rounded-2xl shadow-sm space-y-8 text-zinc-700 dark:text-zinc-300">
            
            <section className="space-y-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">1. Informações que Recolhemos</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Recolhemos dados pessoais quando o utilizador se regista no nosso painel, subscreve a nossa newsletter, envia pedidos de orçamento ou nos contacta diretamente. As informações recolhidas podem incluir nome, endereço de e-mail, número de telefone, nome da empresa e dados de pagamento.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">2. Utilização das Informações</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Os dados recolhidos são utilizados para processar os seus pedidos, gerir as contas de clientes, prestar suporte técnico, enviar comunicações sobre campanhas de email marketing (caso autorizado) e melhorar continuamente os nossos serviços e a experiência do utilizador.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">3. Segurança dos Dados</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                A VisualDesign adota medidas técnicas, organizacionais e administrativas de segurança para proteger as suas informações contra acessos não autorizados, perda, alteração ou divulgação ilegal. Utilizamos encriptação SSL nas transações de dados e servidores seguros de alto desempenho.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">4. Partilha com Terceiros</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Não vendemos ou alugamos dados pessoais a terceiros. As informações apenas poderão ser partilhadas com parceiros de confiança estritamente necessários para a execução dos serviços contratados (como operadoras de pagamento electrónico M-Pesa, E-Mola, processadores de cartão de crédito e entidades oficiais de registo de domínios).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">5. Direitos do Utilizador</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                O utilizador tem o direito de aceder, retificar, actualizar ou solicitar a eliminação dos seus dados pessoais armazenados nos nossos sistemas. Para exercer estes direitos, poderá aceder à sua área de cliente ou enviar um pedido por escrito ao nosso suporte através do formulário de contacto.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">6. Alterações à Política de Privacidade</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                A VisualDesign reserva-se o direito de actualizar esta política a qualquer momento para refletir melhorias técnicas ou alterações regulatórias. Recomendamos a consulta periódica desta página para estar a par de qualquer actualização.
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
