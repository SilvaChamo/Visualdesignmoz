import React from 'react';

const Skeleton = ({ className }: { className?: string }) => (
    <div className={`bg-gray-200 rounded-xl animate-pulse ${className}`} />
);

export default function ClientDashboardSkeleton() {
    return (
        <div className="flex gap-5 animate-in fade-in duration-500">
            {/* Conteúdo principal */}
            <div className="flex-1 space-y-5">
                {/* Saudação Skeleton */}
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-96" />
                </div>

                {/* Cards de Resumo Skeleton (Grid-cols-2) */}
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 flex items-start gap-4">
                            <Skeleton className="w-12 h-12 rounded-lg" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-8 w-16" />
                                <Skeleton className="h-3 w-32" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Billing Alert Skeleton */}
                <div className="bg-slate-50 border border-gray-100 rounded-lg p-4 flex items-start gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-7 w-24 rounded-lg" />
                        </div>
                        <Skeleton className="h-3 w-3/4" />
                    </div>
                </div>

                {/* Tickets Recentes Skeleton */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="p-8 flex flex-col items-center justify-center space-y-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                </div>
            </div>

            {/* Barra lateral direita Skeleton */}
            <div className="w-64 shrink-0 space-y-4">
                {/* Card do cliente Skeleton */}
                <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col items-center">
                    <Skeleton className="w-16 h-16 rounded-full mb-3" />
                    <Skeleton className="h-4 w-12 rounded-full mb-6" />
                    <div className="w-full space-y-2 border-t border-gray-100 pt-4">
                        <Skeleton className="h-4 w-3/4 mx-auto" />
                        <Skeleton className="h-3 w-1/2 mx-auto" />
                        <Skeleton className="h-3 w-2/3 mx-auto" />
                    </div>
                </div>

                {/* Crédito Skeleton */}
                <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3 flex flex-col items-center">
                    <Skeleton className="h-3 w-28 uppercase" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                </div>
            </div>
        </div>
    );
}
