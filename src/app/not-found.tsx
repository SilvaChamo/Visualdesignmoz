'use client'

import React from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'

/**
 * 404 com tema claro e escuro (segue o tema do site). Arredondamentos padronizados: cartão 10 px, botões 8 px
 * (os mesmos do login e do <Button>). A página dos sites sem conteúdo (public/pagina-em-construcao) usa este desenho.
 */
export default function NotFound() {
    const { t } = useI18n()

    return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Premium Background Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div
                    className="opacity-40 dark:opacity-100"
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
                    className="opacity-40 dark:opacity-100"
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
                className="absolute inset-0 opacity-[0.06] dark:opacity-[0.15] pointer-events-none text-zinc-900 dark:text-white"
                style={{
                    backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}
            />

            {/* Main Content */}
            <div className="relative z-10 flex flex-col items-center text-center max-w-xl">
                {/* Animated 404 Text */}
                <div className="relative -mb-16 md:-mb-20">
                    <h1 className="text-[12rem] md:text-[16rem] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-zinc-400 to-white dark:from-white dark:to-gray-800 opacity-30 dark:opacity-20 select-none">
                        404
                    </h1>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl md:text-5xl font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white dark:drop-shadow-2xl">
                            {t('notfound.lost')}
                        </span>
                    </div>
                </div>

                {/* Message */}
                <div className="p-8 md:p-10 rounded-[10px] border border-zinc-200 bg-white/80 shadow-[0_24px_60px_-28px_rgba(24,24,27,0.3)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] mb-10">
                    <h2 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white mb-3 uppercase tracking-wider">
                        {t('notfound.title')}
                    </h2>
                    <p className="text-zinc-500 dark:text-gray-400 text-sm md:text-base leading-relaxed mb-7">
                        {t('notfound.desc')}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            href="/"
                            className="inline-flex h-10 items-center justify-center px-6 bg-red-700 hover:bg-red-600 text-white font-bold rounded-[8px] transition-colors uppercase text-[11px] tracking-widest"
                        >
                            {t('notfound.home')}
                        </Link>
                        <Link
                            href="/contacto"
                            className="inline-flex h-10 items-center justify-center px-6 bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-300 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/10 font-bold rounded-[8px] transition-colors uppercase text-[11px] tracking-widest"
                        >
                            {t('notfound.support')}
                        </Link>
                    </div>
                </div>

                {/* Logo */}
                <div className="transition-opacity duration-500 hover:opacity-100 opacity-70 dark:opacity-50">
                    <img
                        src="/assets/logo-entrada.jpg"
                        alt="VisualDesign"
                        className="h-12 object-contain mix-blend-multiply dark:hidden"
                    />
                    <img
                        src="/assets/logotipoII.png"
                        alt="VisualDesign"
                        className="hidden h-20 object-contain brightness-75 grayscale hover:grayscale-0 dark:block"
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
