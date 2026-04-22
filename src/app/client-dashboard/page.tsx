'use client'

import React, { useState, useEffect } from 'react'
import { 
  User, 
  Settings, 
  CreditCard, 
  HelpCircle, 
  BarChart3, 
  Mail, 
  Shield, 
  Bell,
  ChevronRight,
  LogOut,
  Home,
  Server,
  Globe,
  Database,
  FileText,
  Download,
  Plus,
  Search,
  Filter,
  MoreVertical
} from 'lucide-react'
import { createClientInstance } from '@/lib/supabase'
import { useAuth } from '@/components/auth/AuthProvider'

// Skeleton Components
const SkeletonCard = () => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
    <div className="space-y-2">
      <div className="h-3 bg-gray-200 rounded"></div>
      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
    </div>
  </div>
)

const SkeletonList = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
)

// Menu Component
const MenuItem = ({ icon: Icon, label, href, active = false, badge = null }: any) => (
  <a
    href={href}
    className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
      active 
        ? 'bg-red-50 text-red-600 border border-red-100' 
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`}
  >
    <Icon className="w-5 h-5" />
    <span className="font-medium">{label}</span>
    {badge && (
      <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
        {badge}
      </span>
    )}
  </a>
)

// Stats Card Component
const StatsCard = ({ title, value, icon: Icon, color = 'blue', trend = null }: any) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
    <div className="flex items-center justify-between mb-4">
      <div className={`w-12 h-12 rounded-xl bg-${color}-50 flex items-center justify-center`}>
        <Icon className={`w-6 h-6 text-${color}-600`} />
      </div>
      {trend && (
        <span className={`text-xs font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
    </div>
  </div>
)

// Service Card Component
const ServiceCard = ({ name, status, domain, expiry, icon: Icon }: any) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{name}</h3>
          <p className="text-sm text-gray-500">{domain}</p>
        </div>
      </div>
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
        status === 'active' 
          ? 'bg-green-100 text-green-800' 
          : 'bg-red-100 text-red-800'
      }`}>
        {status === 'active' ? 'Ativo' : 'Inativo'}
      </span>
    </div>
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">Expira em {expiry}</span>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </div>
  </div>
)

// Main Component
export default function ClientDashboard() {
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('dashboard')
  const [stats, setStats] = useState({
    domains: 0,
    emails: 0,
    storage: 0,
    bandwidth: 0
  })
  const [services, setServices] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    // Simular carregamento de dados
    const loadData = async () => {
      try {
        // Simular delay de rede
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Dados mockados
        setStats({
          domains: 3,
          emails: 12,
          storage: 75,
          bandwidth: 45
        })
        
        setServices([
          {
            id: 1,
            name: 'Hospedagem Professional',
            domain: 'visualdesigne.com',
            status: 'active',
            expiry: '15/05/2026',
            icon: Globe
          },
          {
            id: 2,
            name: 'Email Professional',
            domain: 'mail.visualdesigne.com',
            status: 'active',
            expiry: '15/05/2026',
            icon: Mail
          },
          {
            id: 3,
            name: 'SSL Certificate',
            domain: 'visualdesigne.com',
            status: 'active',
            expiry: '20/04/2026',
            icon: Shield
          }
        ])
        
        setNotifications([
          { id: 1, type: 'warning', message: 'Renovação em 15 dias', read: false },
          { id: 2, type: 'info', message: 'Backup concluído', read: true }
        ])
        
      } catch (error) {
        console.error('Erro ao carregar dados:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

  const menuItems = [
    { icon: Home, label: 'Dashboard', href: '/dashboard', id: 'dashboard' },
    { icon: User, label: 'Meus Dados', href: '/client', id: 'profile' },
    { icon: Server, label: 'Serviços', href: '/servicos', id: 'services', badge: 3 },
    { icon: CreditCard, label: 'Faturação', href: '/faturacao', id: 'billing' },
    { icon: HelpCircle, label: 'Suporte', href: '/suporte', id: 'support' },
    { icon: BarChart3, label: 'Relatórios', href: '/relatorios', id: 'reports' }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          {/* Sidebar Skeleton */}
          <div className="w-64 bg-white border-r border-gray-200 p-4">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-8"></div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-12 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
          
          {/* Content Skeleton */}
          <div className="flex-1 p-6">
            <div className="mb-6">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            
            <SkeletonList />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-4">
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900">VisualDesign</h2>
            <p className="text-sm text-gray-500">Painel Cliente</p>
          </div>
          
          <nav className="space-y-1">
            {menuItems.map(item => (
              <MenuItem
                key={item.id}
                {...item}
                active={activeSection === item.id}
                onClick={() => setActiveSection(item.id)}
              />
            ))}
          </nav>
          
          <div className="mt-8 pt-8 border-t border-gray-200">
            <button
              onClick={signOut}
              className="flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all w-full"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {menuItems.find(item => item.id === activeSection)?.label}
            </h1>
            <p className="text-gray-500">
              {activeSection === 'dashboard' && 'Visão geral dos seus serviços e recursos'}
              {activeSection === 'profile' && 'Gere os seus dados pessoais e configurações'}
              {activeSection === 'services' && 'Gere todos os seus serviços de hospedagem'}
              {activeSection === 'billing' && 'Visualize faturas e pagamentos'}
              {activeSection === 'support' && 'Obtenha ajuda e suporte técnico'}
              {activeSection === 'reports' && 'Relatórios e estatísticas detalhadas'}
            </p>
          </div>

          {/* Dashboard Content */}
          {activeSection === 'dashboard' && (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                  title="Domínios"
                  value={stats.domains}
                  icon={Globe}
                  color="blue"
                  trend={12}
                />
                <StatsCard
                  title="Contas Email"
                  value={stats.emails}
                  icon={Mail}
                  color="green"
                  trend={8}
                />
                <StatsCard
                  title="Armazenamento"
                  value={`${stats.storage}%`}
                  icon={Database}
                  color="purple"
                  trend={-2}
                />
                <StatsCard
                  title="Tráfego"
                  value={`${stats.bandwidth}%`}
                  icon={BarChart3}
                  color="orange"
                  trend={15}
                />
              </div>

              {/* Services List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Serviços Ativos</h2>
                  <button className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900">
                    <Filter className="w-4 h-4" />
                    <span>Filtrar</span>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {services.map(service => (
                    <ServiceCard key={service.id} {...service} />
                  ))}
                </div>
              </div>

              {/* Notifications */}
              {notifications.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Notificações</h2>
                  <div className="space-y-3">
                    {notifications.map(notif => (
                      <div
                        key={notif.id}
                        className={`p-4 rounded-xl border ${
                          notif.read 
                            ? 'bg-white border-gray-200' 
                            : 'bg-blue-50 border-blue-100'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <Bell className={`w-5 h-5 mt-0.5 ${
                            notif.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                          }`} />
                          <div className="flex-1">
                            <p className="text-sm text-gray-900">{notif.message}</p>
                            <p className="text-xs text-gray-500 mt-1">Agora há pouco</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Profile Content */}
          {activeSection === 'profile' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="text-center py-12">
                <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Perfil do Cliente</h3>
                <p className="text-gray-500 mb-6">Gere os seus dados pessoais e configurações</p>
                <a
                  href="/client"
                  className="inline-flex items-center space-x-2 bg-red-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-red-700 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>Gerir Perfil</span>
                </a>
              </div>
            </div>
          )}

          {/* Other Sections Placeholder */}
          {activeSection !== 'dashboard' && activeSection !== 'profile' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {menuItems.find(item => item.id === activeSection)?.label}
                </h3>
                <p className="text-gray-500 mb-6">
                  Esta secção está em desenvolvimento e estará disponível em breve.
                </p>
                <button className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                  Em Breve
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
