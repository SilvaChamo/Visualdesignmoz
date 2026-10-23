'use client';

import { Suspense } from 'react';
import { CheckoutContent } from '@/components/checkout/CheckoutContent';
import { Spinner } from '@/components/ui/spinner';

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Spinner className="w-10 h-10" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
