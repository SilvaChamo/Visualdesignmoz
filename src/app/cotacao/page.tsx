'use client';

import { Suspense } from 'react';
import { CotacaoContent } from '@/components/cotacao/CotacaoContent';
import { Spinner } from '@/components/ui/spinner';

export default function CotacaoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <Spinner className="w-10 h-10" />
        </div>
      }
    >
      <CotacaoContent />
    </Suspense>
  );
}
