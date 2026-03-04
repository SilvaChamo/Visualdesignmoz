'use client'

import React from 'react'

import { Database, LayoutGrid, Lock, Rocket, LogIn, Gauge, Plus } from 'lucide-react'
import Link from 'next/link'

export default function WordPressManagerPage() {
    const features = [
        {
            icon: Database,
            title: 'Backups',
            description: 'Worried about your site backups? WordPress Manager allows you to take data or database level backups.',
            href: '/dashboard/wordpress/backups'
        },
        {
            icon: LayoutGrid,
            title: 'Staging Sites',
            description: 'Not ready to go live yet? You can create staging sites and easily deploy them to production with one-click using WordPress Manager.',
            href: '/dashboard/wordpress/staging'
        },
        {
            icon: Lock,
            title: 'One Click SSL',
            description: "Free One Click SSL Certificates by Let's Encrypt. With Auto-renewal enabled by default, CyberPanel will automagically renew your Certificates before they expire!",
            href: '/dashboard/wordpress/ssl'
        },
        {
            icon: Rocket,
            title: 'One Click Install',
            description: 'Deploy WordPress sites within 1 minute using our brand new WordPress Manager. We will take care of Speed, Security and maintenance of your WordPress site.',
            href: '/dashboard/wordpress/install'
        },
        {
            icon: LogIn,
            title: 'Auto Login',
            description: 'Have you forgotten your WordPress dashboard login information? To access your WordPress admin account, simply use the CyberPanel WordPress manager Auto Login feature.',
            href: '/dashboard/wordpress/login'
        },
        {
            icon: Gauge,
            title: 'LiteSpeed Cache',
            description: 'Nothing beats LSCache plugin on LiteSpeed server. Every WordPress site deployed via WordPress manager gets LSCache plugin installed and configured.',
            href: '/dashboard/wordpress/cache'
        }
    ]

    return (
        <div className="flex-1 p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">WordPress Manager</h1>
                    <p className="text-gray-500 mt-1">Manage all your WordPress installations from one place.</p>
                </div>
                <Link
                    href="/dashboard/wordpress/deploy"
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg transition-colors font-medium shadow-sm transition-transform hover:-translate-y-0.5"
                >
                    <Plus className="w-5 h-5" />
                    Deploy WordPress
                </Link>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {features.map((feature, index) => {
                    const Icon = feature.icon
                    return (
                        <div
                            key={feature.title}
                            className="bg-white p-8 rounded-2xl border border-indigo-50 shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
                        >
                            <Link href={feature.href} className="block h-full">
                                <div className="flex flex-col items-center text-center space-y-4">
                                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300 shadow-sm">
                                        <Icon className="w-8 h-8 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                        {feature.title}
                                    </h3>
                                    <p className="text-gray-500 leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            </Link>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
