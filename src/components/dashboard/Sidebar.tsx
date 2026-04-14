'use client'

import React from 'react'
import {
    Home,
    Package,
    Globe,
    CreditCard,
    Settings,
    LifeBuoy,
    LogOut,
    ChevronRight,
    Menu,
    X,
    ShoppingBag
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n'


interface SidebarItemProps {
    icon: React.ElementType
    label: string
    href: string
    active?: boolean
    onClick?: () => void
    subItems?: { label: string; href: string }[]
    isNew?: boolean
}

const SidebarItem = ({ icon: Icon, label, href, active, onClick, subItems, isNew }: SidebarItemProps) => {
    const [isExpanded, setIsExpanded] = React.useState(false)
    const hasSubItems = subItems && subItems.length > 0

    const handleClick = (e: React.MouseEvent) => {
        if (hasSubItems) {
            e.preventDefault()
            setIsExpanded(!isExpanded)
        } else if (onClick) {
            onClick()
        }
    }

    return (
        <div className="flex flex-col">
            <Link
                href={href}
                onClick={handleClick}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${active && !hasSubItems
                    ? 'bg-red-50 text-red-600 border-l-4 border-red-600 rounded-r-lg'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 rounded-lg'
                    }`}
            >
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${isNew ? 'bg-indigo-100 text-indigo-600' : ''}`}>
                    <Icon className={`w-5 h-5 ${active && !hasSubItems ? 'text-red-600' : 'group-hover:text-red-500'} ${isNew ? 'text-indigo-600' : ''}`} />
                </div>
                <span className="font-medium flex-1">{label}</span>
                {isNew && (
                    <span className="px-2 py-0.5 text-xs font-bold text-white bg-orange-500 rounded-md">
                        NEW
                    </span>
                )}
                {hasSubItems ? (
                    <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                ) : (
                    active && <ChevronRight className="w-4 h-4 ml-auto" />
                )}
            </Link>

            {hasSubItems && isExpanded && (
                <div className="flex flex-col mt-1 ml-4 pl-4 border-l border-gray-100 space-y-1">
                    {subItems.map((subItem) => (
                        <Link
                            key={subItem.label}
                            href={subItem.href}
                            onClick={onClick}
                            className="text-sm text-gray-500 hover:text-gray-900 py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            {subItem.label}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function DashboardSidebar() {
    const pathname = usePathname()
    const [isOpen, setIsOpen] = React.useState(false)
    const { t } = useI18n()

    const menuItems = [
        { icon: Home, label: t('sidebar.home'), href: '/dashboard' },
        { icon: Package, label: t('sidebar.myPlans'), href: '/dashboard/servicos' },
        {
            icon: Globe, label: t('sidebar.domains'), href: '#', subItems: [
                { label: t('sidebar.myDomains'), href: '/dashboard/dominios' },
                { label: t('sidebar.dnsManagement'), href: '/admin?section=domains-dns' },
                { label: t('sidebar.websitePreview'), href: '/admin?section=website-preview' },
                { label: t('sidebar.emailImport'), href: '/admin?section=email-import' }
            ]
        },
        {
            icon: Globe,
            label: t('sidebar.wordpress'),
            href: '#',
            isNew: true,
            subItems: [
                { label: t('sidebar.deployWp'), href: '/dashboard/wordpress' },
                { label: t('sidebar.listWp'), href: '/dashboard/wordpress/list' },
                { label: t('sidebar.configPlugins'), href: '/dashboard/wordpress/plugins' },
                { label: t('sidebar.restoreBackups'), href: '/dashboard/wordpress/restore' },
                { label: t('sidebar.remoteBackup'), href: '/dashboard/wordpress/remote-backup' }
            ]
        },
        { icon: ShoppingBag, label: t('sidebar.store'), href: '/dashboard/marketplace' },
        { icon: CreditCard, label: t('sidebar.invoices'), href: '/dashboard/faturas' },
        { icon: Settings, label: t('sidebar.settings'), href: '/dashboard/definicoes' },
        { icon: LifeBuoy, label: t('sidebar.support'), href: '/dashboard/suporte' },
        { icon: Globe, label: t('sidebar.viewClient'), href: '/client' },
    ]

    return (
        <>
            {/* Mobile Toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden fixed bottom-6 right-6 z-50 p-4 bg-red-600 text-white rounded-full shadow-2xl"
            >
                {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Sidebar Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="h-full flex flex-col p-6">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-12 px-2">
                        <div className="w-12 h-12 flex items-center justify-center">
                            <img src="/assets/Horizontal_logo.png" alt="Visual Design" className="h-10 object-contain" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 tracking-tighter uppercase leading-none">Visual<br />Design</h2>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 space-y-2">
                        {menuItems.map((item) => (
                            <SidebarItem
                                key={item.label}
                                {...item}
                                active={pathname === item.href}
                                onClick={() => setIsOpen(false)}
                            />
                        ))}
                    </nav>

                    {/* Footer */}
                    <div className="mt-auto pt-6 border-t border-gray-100">
                        <button className="flex items-center gap-3 px-4 py-3 w-full text-gray-500 hover:text-red-500 transition-colors group">
                            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            <span className="font-medium">{t('sidebar.logout')}</span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
