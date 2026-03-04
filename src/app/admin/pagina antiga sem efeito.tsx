'use client'

import { useState, useEffect, useRef } from 'react'

import { 
  Menu, 
  X, 
  Home, 
  Globe, 
  Users, 
  Package, 
  Settings, 
  Server,
  Database,
  Mail,
  FileText,
  Shield,
  GitBranch,
  Code,
  UserPlus,
  Building,
  Key,
  Lock,
  FolderOpen,
  Upload,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { CpanelDashboard } from './CpanelDashboard'
import { lsGet, lsSet } from '@/lib/local-storage'
import { cyberPanelAPI } from '@/lib/cyberpanel-api'
import type { CyberPanelWebsite, CyberPanelUser, CyberPanelPackage } from '@/lib/cyberpanel-api'

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [sidebarWidth, setSidebarWidth] = useState(180)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isResizing, setIsResizing] = useState(false)
  const [cyberPanelSites, setCyberPanelSites] = useState<CyberPanelWebsite[]>([])
  const [cyberPanelUsers, setCyberPanelUsers] = useState<CyberPanelUser[]>([])
  const [cyberPanelPackages, setCyberPanelPackages] = useState<CyberPanelPackage[]>([])
  const [isFetchingCyberPanel, setIsFetchingCyberPanel] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const minSidebarWidth = 200
  const maxSidebarWidth = 400
  const collapsedWidth = 64

  useEffect(() => {
    loadCyberPanelData()
  }, [])

  const loadCyberPanelData = async () => {
    setIsFetchingCyberPanel(true)
    try {
      const adminToken = lsGet('admin-token')
      if (!adminToken) return

      const [sites, users, packages] = await Promise.all([
        cyberPanelAPI.listWebsites(),
        cyberPanelAPI.listUsers(),
        cyberPanelAPI.listPackages()
      ])

      setCyberPanelSites(sites)
      setCyberPanelUsers(users)
      setCyberPanelPackages(packages)

      lsSet('cp_sites_v1', sites)
      lsSet('cp_users_v1', users)
      lsSet('cp_packages_v1', packages)
    } catch (error) {
      console.error('Error loading CyberPanel data:', error)
    } finally {
      setIsFetchingCyberPanel(false)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const newWidth = e.clientX
      if (newWidth >= minSidebarWidth && newWidth <= maxSidebarWidth) {
        setSidebarWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'websites', label: 'Websites', icon: Globe },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'packages', label: 'Packages', icon: Package },
    { id: 'subdomains', label: 'Subdomains', icon: Server },
    { id: 'databases', label: 'Databases', icon: Database },
    { id: 'ftp', label: 'FTP', icon: FolderOpen },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'ssl', label: 'SSL', icon: Lock },
    { id: 'dns', label: 'DNS', icon: Server },
    { id: 'backup', label: 'Backup', icon: Download },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  const currentSidebarWidth = isCollapsed ? collapsedWidth : sidebarWidth

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className="relative bg-slate-800 text-white flex flex-col shadow-xl"
        style={{ width: `${currentSidebarWidth}px` }}
      >
        {/* Sidebar Header */}
        <div className="p-3 border-b border-slate-700">
          <div className="flex items-center justify-between">
            {isCollapsed && (
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded hover:bg-slate-700 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            )}
            {!isCollapsed && (
              <>
                <h1 className="font-bold text-sm">Admin Panel</h1>
                <button
                  onClick={toggleSidebar}
                  className="p-1.5 rounded hover:bg-slate-700 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center p-2 rounded transition-colors ${
                    activeSection === item.id
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-slate-700 text-gray-300'
                  }`}
                  title={item.label}
                >
                  <Icon size={16} />
                  {!isCollapsed && <span className="ml-3 text-sm">{item.label}</span>}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-700">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <UserPlus size={12} />
            </div>
            {!isCollapsed && (
              <div>
                <p className="text-xs font-medium">Admin</p>
                <p className="text-xs text-gray-400">silva.chamo@gmail.com</p>
              </div>
            )}
          </div>
        </div>

        {/* Resize Handle */}
        {!isCollapsed && (
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
            onMouseDown={handleMouseDown}
          />
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-semibold text-gray-800 capitalize">
                {activeSection}
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={loadCyberPanelData}
                className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                disabled={isFetchingCyberPanel}
              >
                <RefreshCw size={16} className={isFetchingCyberPanel ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4">
            {activeSection === 'dashboard' && (
              <div
                key="dashboard"
              >
                <CpanelDashboard
                  sites={cyberPanelSites}
                  users={cyberPanelUsers}
                  isFetching={isFetchingCyberPanel}
                  onNavigate={(section) => setActiveSection(section)}
                  onRefresh={loadCyberPanelData}
                />
              </div>
            )}

            {activeSection === 'websites' && (
              <div
                key="websites"
                className="space-y-4"
              >
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <h3 className="text-lg font-semibold mb-4">Websites Management</h3>
                  <div className="grid gap-3">
                    {cyberPanelSites.map((site, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{site.domain}</h4>
                            <p className="text-sm text-gray-600">Owner: {site.owner || 'admin'}</p>
                            <p className="text-sm text-gray-600">Package: {site.package || 'Default'}</p>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            site.state === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {site.state || 'Unknown'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'users' && (
              <div
                key="users"
                className="space-y-4"
              >
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <h3 className="text-lg font-semibold mb-4">Users Management</h3>
                  <div className="grid gap-3">
                    {cyberPanelUsers.map((user, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{user.userName}</h4>
                            <p className="text-sm text-gray-600">Email: {user.email || 'N/A'}</p>
                            <p className="text-sm text-gray-600">Type: {user.type || 'User'}</p>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            user.suspended ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {user.suspended ? 'Suspended' : 'Active'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'packages' && (
              <div
                key="packages"
                className="space-y-4"
              >
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <h3 className="text-lg font-semibold mb-4">Packages Management</h3>
                  <div className="grid gap-3">
                    {cyberPanelPackages.map((pkg, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-3">
                        <div>
                          <h4 className="font-medium">{pkg.packageName}</h4>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-600">
                            <p>Disk Space: {pkg.diskSpace || 'Unlimited'}</p>
                            <p>Bandwidth: {pkg.bandwidth || 'Unlimited'}</p>
                            <p>Email Accounts: {pkg.emailAccounts || 'Unlimited'}</p>
                            <p>Databases: {pkg.dataBases || 'Unlimited'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {['subdomains', 'databases', 'ftp', 'email', 'ssl', 'dns', 'backup', 'settings'].includes(activeSection) && (
              <div
                key={activeSection}
                className="bg-white rounded-lg shadow-sm p-4"
              >
                <h3 className="text-lg font-semibold mb-4 capitalize">
                  {activeSection} Management
                </h3>
                <p className="text-gray-600">
                  {activeSection} section will be implemented with CyberPanel integration.
                </p>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">
                    This section will connect to CyberPanel API to manage {activeSection}.
                  </p>
                </div>
              </div>
            )}
        </main>
      </div>
    </div>
  )
}
