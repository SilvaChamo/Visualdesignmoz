// Componente reutilizável para blocos skeleton
const Skeleton = ({ className }: { className?: string }) => (
    <div className={`bg-gray-200 rounded-xl animate-pulse ${className}`} />
)

export default function DashboardSkeleton() {
    return (
        <div className="space-y-10">
            {/* Welcome Header Skeleton */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-200">
                <div className="space-y-2">
                    <Skeleton className="h-10 w-64 rounded-lg" />
                    <Skeleton className="h-5 w-80 rounded-lg" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-32 rounded-xl" />
                    <Skeleton className="h-10 w-36 rounded-xl" />
                </div>
            </div>

            {/* Main Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Service Card Skeleton — col-span-2 */}
                <div className="lg:col-span-2">
                    <div className="bg-white p-8 rounded-3xl border border-gray-200 h-full shadow-sm">
                        <div className="flex items-start justify-between mb-8">
                            <div className="space-y-3">
                                <Skeleton className="h-6 w-24 rounded-full" />
                                <Skeleton className="h-8 w-48 rounded-lg" />
                                <Skeleton className="h-5 w-56 rounded-lg" />
                            </div>
                            <Skeleton className="h-11 w-11 rounded-2xl" />
                        </div>
                        <div className="grid md:grid-cols-2 gap-10 mt-8">
                            {[0, 1].map((i) => (
                                <div key={i} className="space-y-3">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-4 w-28 rounded" />
                                        <Skeleton className="h-4 w-16 rounded" />
                                    </div>
                                    <Skeleton className="h-2 w-full rounded-full" />
                                    <Skeleton className="h-4 w-32 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column Skeleton */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-12 w-12 rounded-2xl" />
                            <div className="space-y-2">
                                <Skeleton className="h-3 w-28 rounded" />
                                <Skeleton className="h-6 w-32 rounded-lg" />
                            </div>
                        </div>
                        <Skeleton className="h-12 w-full rounded-2xl" />
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-2xl" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-3 w-20 rounded" />
                            <Skeleton className="h-5 w-28 rounded-lg" />
                        </div>
                        <Skeleton className="h-5 w-5 rounded" />
                    </div>
                    <div className="bg-gray-200 p-6 rounded-3xl animate-pulse space-y-3">
                        <Skeleton className="h-6 w-40 rounded-lg bg-gray-300" />
                        <Skeleton className="h-4 w-52 rounded bg-gray-300" />
                        <Skeleton className="h-5 w-36 rounded bg-gray-300" />
                    </div>
                </div>
            </div>

            {/* Recommended Services Skeleton */}
            <div className="pt-10">
                <div className="flex items-center justify-between mb-8">
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-52 rounded-lg" />
                        <Skeleton className="h-4 w-64 rounded" />
                    </div>
                    <Skeleton className="h-5 w-32 rounded" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                            <Skeleton className="h-12 w-12 rounded-2xl" />
                            <Skeleton className="h-5 w-32 rounded-lg" />
                            <Skeleton className="h-4 w-full rounded" />
                            <Skeleton className="h-4 w-3/4 rounded" />
                            <Skeleton className="h-4 w-24 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
