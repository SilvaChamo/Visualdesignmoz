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

    const menuItems = [
        { icon: Home, label: 'Início', href: '/dashboard' },
        { icon: Package, label: 'Meus Planos', href: '/dashboard/servicos' },
        {
            icon: Globe, label: 'Domínios', href: '#', subItems: [
                { label: 'Meus Domínios', href: '/dashboard/dominios' },
                { label: 'Gestão de DNS', href: '/admin?section=domains-dns' }
            ]
        },
        {
            icon: Globe, // Using Globe as fallback for WordPress, can be replaced with custom SVG later
            label: 'WordPress',
            href: '#',
            isNew: true,
            subItems: [
                { label: 'Deploy WordPress', href: '/dashboard/wordpress' },
                { label: 'List WordPress', href: '/dashboard/wordpress/list' },
                { label: 'Configure Plugins', href: '/dashboard/wordpress/plugins' },
                { label: 'Restore Backups', href: '/dashboard/wordpress/restore' },
                { label: 'Remote Backup', href: '/dashboard/wordpress/remote-backup' }
            ]
        },
        { icon: ShoppingBag, label: 'Loja de Serviços', href: '/dashboard/marketplace' },
        { icon: CreditCard, label: 'Faturas', href: '/dashboard/faturas' },
        { icon: Settings, label: 'Definições', href: '/dashboard/definicoes' },
        { icon: LifeBuoy, label: 'Suporte', href: '/dashboard/suporte' },
        { icon: Globe, label: 'Ver Painel Cliente', href: '/client' },
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
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
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
                            <img src="/assets/simbolo.png" alt="Visual Design" className="w-full h-full object-contain" />
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
                            <span className="font-medium">Sair da Conta</span>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
