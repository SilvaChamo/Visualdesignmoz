'use client'

import { useI18n } from '@/lib/i18n'
import { Server, Globe, Shield, Zap, Database, Clock } from 'lucide-react'

export default function ServidorPage() {
  const { t } = useI18n()

  const recursosServidor = [
    {
      icone: <Server className="w-8 h-8" />,
      titulo: 'Servidores VPS',
      desc: 'Performance dedicada com recursos isolados para a sua aplicação.',
      lista: ['CPU Dedicado', 'RAM Garantida', 'Acesso Root', 'Painel de Controlo']
    },
    {
      icone: <Globe className="w-8 h-8" />,
      titulo: 'Cloud Hosting',
      desc: 'Escalabilidade e alta disponibilidade na nuvem.',
      lista: ['Escala Fácil', 'Load Balancing', 'Redundância', 'Uptime 99.9%']
    },
    {
      icone: <Shield className="w-8 h-8" />,
      titulo: 'Segurança Avançada',
      desc: 'Proteção contra ataques DDoS e firewalls configurados.',
      lista: ['Firewall CSF', 'Proteção DDoS', 'Backups Diários', 'Isolamento']
    },
    {
      icone: <Zap className="w-8 h-8" />,
      titulo: 'Velocidade Extrema',
      desc: 'Discos NVMe SSD para carregamento ultra-rápido.',
      lista: ['Discos NVMe', 'LiteSpeed Web Server', 'Cache Avançado', 'Baixa Latência']
    }
  ]

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Hero Section */}
      <div className="relative bg-black text-white py-20">
        <div className="absolute inset-0 opacity-40">
          <img src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80" alt="Datacenter" className="w-full h-full object-cover" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 text-center">
          <span className="text-red-500 font-bold uppercase text-sm tracking-wider">Infraestrutura</span>
          <h1 className="text-4xl md:text-5xl font-bold mt-2 mb-4">Servidores VPS & Cloud</h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Soluções robustas de alojamento para projetos que exigem máxima performance, segurança e controlo total.
          </p>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {recursosServidor.map((item, index) => (
            <div key={index} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-6">
                {item.icone}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">{item.titulo}</h3>
              <p className="text-slate-600 text-sm mb-6">{item.desc}</p>
              <ul className="grid grid-cols-2 gap-2">
                {item.lista.map((li, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-slate-500">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                    {li}
                  </li>
                ))}
              </ul>
              <button className="mt-6 text-sm font-bold text-red-600 hover:text-red-700 transition-colors">
                Saber Mais &rarr;
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
