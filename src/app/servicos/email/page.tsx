'use client'

import { useI18n } from '@/lib/i18n'
import { Mail, Users, Shield, Settings, Cloud, Smartphone } from 'lucide-react'

export default function EmailProfissional() {
  const { t } = useI18n()

  const servicosEmail = [
    { icone: <Mail className="w-8 h-8" />, titulo: "Email com Domínio Próprio", descricao: "Caixas de correio profissionais com o seu domínio (nome@suaempresa.com)", servicos: ["Endereço personalizado", "Armazenamento generoso", "Sem publicidade", "Webmail moderno", "Configuração incluída"] },
    { icone: <Users className="w-8 h-8" />, titulo: "Email Corporativo", descricao: "Solução completa para equipas com gestão centralizada", servicos: ["Contas ilimitadas", "Calendário partilhado", "Contactos corporativos", "Grupos de distribuição", "Painel admin"] },
    { icone: <Cloud className="w-8 h-8" />, titulo: "Microsoft 365 / Google Workspace", descricao: "Integração com as principais plataformas de produtividade", servicos: ["Office 365 completo", "Google Workspace", "OneDrive / Drive", "Teams / Meet", "Licenciamento"] },
    { icone: <Shield className="w-8 h-8" />, titulo: "Segurança de Email", descricao: "Proteção avançada contra spam, phishing e malware", servicos: ["Anti-spam avançado", "Anti-phishing", "SPF / DKIM / DMARC", "Encriptação TLS", "Proteção malware"] },
    { icone: <Settings className="w-8 h-8" />, titulo: "Migração de Email", descricao: "Migração completa sem perda de dados", servicos: ["Migração de dados", "Importação contactos", "Preservação histórico", "Zero downtime", "Suporte transição"] },
    { icone: <Smartphone className="w-8 h-8" />, titulo: "Email Mobile", descricao: "Acesso em qualquer dispositivo com sincronização real-time", servicos: ["iOS e Android", "Push notifications", "Sincronização auto", "Exchange ActiveSync", "App nativo"] }
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-[#404040] relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
        <div className="absolute inset-0 bg-black/50" />
        <div className="container mx-auto max-w-7xl px-6 pt-[150px] pb-[80px] flex items-center justify-center min-h-[300px] relative z-10">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Email Profissional</h1>
            <p className="text-base text-white font-normal">Comunique com profissionalismo usando email com o domínio da sua empresa</p>
          </div>
        </div>
      </div>
      <div className="py-16">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {servicosEmail.map((s, i) => (
              <div key={i} className="bg-white text-black/70 p-6 rounded-lg">
                <div className="flex items-center mb-4"><div className="text-red-500 mr-3">{s.icone}</div><h3 className="text-xl font-bold">{s.titulo}</h3></div>
                <p className="text-black/70 mb-6 text-sm leading-relaxed">{s.descricao}</p>
                <div className="mb-6">
                  <h4 className="font-medium mb-3 text-sm">O que inclui:</h4>
                  <ul className="space-y-0">{s.servicos.map((item, idx) => (<li key={idx} className="flex items-center text-black/70 text-sm"><span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>{item}</li>))}</ul>
                </div>
                <button className="w-fit bg-black text-white px-4 py-3 rounded font-medium hover:bg-red-600 transition-colors">Solicitar Orçamento</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
