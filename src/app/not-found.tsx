'use client'

import React from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'

export default function NotFound() {
    const { t } = useI18n()

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Premium Background Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div
                    style={{
                        position: 'absolute',
                        top: '-20%',
                        left: '-20%',
                        width: '80%',
                        height: '80%',
                        background: 'radial-gradient(ellipse at top left, rgba(180,0,0,0.3) 0%, rgba(120,0,0,0.15) 50%, transparent 80%)',
                        filter: 'blur(100px)',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: '-10%',
                        right: '-10%',
                        width: '60%',
                        height: '60%',
                        background: 'radial-gradient(ellipse at bottom right, rgba(80,0,0,0.2) 0%, transparent 70%)',
                        filter: 'blur(80px)',
                    }}
                />
            </div>

            {/* Grid Pattern Overlay */}
            <div
                className="absolute inset-0 opacity-[0.15] pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}
            />

            {/* Main Content */}
            <div className="relative z-10 flex flex-col items-center text-center max-w-xl">
                {/* Animated 404 Text */}
                <div className="relative mb-8">
                    <h1 className="text-[12rem] md:text-[16rem] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-800 opacity-20 select-none">
                        404
                    </h1>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl md:text-5xl font-black uppercase tracking-[0.2em] text-white drop-shadow-2xl">
                            {t('notfound.lost')}
                        </span>
                    </div>
                </div>

                {/* Message */}
                <div
                    className="p-8 md:p-12 rounded-3xl border border-white/10 backdrop-blur-xl bg-white/5 shadow-2xl mb-10"
                    style={{
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}
                >
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-4 uppercase tracking-wider">
                        {t('notfound.title')}
                    </h2>
                    <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-8">
                        {t('notfound.desc')}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/"
                            className="px-8 py-4 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-red-900/20 uppercase text-xs tracking-widest"
                        >
                            {t('notfound.home')}
                        </Link>
                        <Link
                            href="/contacto"
                            className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all duration-300 uppercase text-xs tracking-widest"
                        >
                            {t('notfound.support')}
                        </Link>
                    </div>
                </div>

                {/* Logo */}
                <div className="transition-opacity duration-500 hover:opacity-100 opacity-50">
                    <img
                        src="/assets/logotipoII.png"
                        alt="Portal Digitale"
                        className="h-20 object-contain brightness-75 grayscale hover:grayscale-0"
                    />
                </div>
            </div>

            {/* Footer Line Detail */}
            <div
                className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none opacity-50"
                style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #CC0000, transparent)' }}
            />
        </div>
    )
}
