'use client';

import { GuestDashboard } from '@/components/guest/GuestDashboard';
import { supabase } from '@/lib/supabase-client';
import { useEffect, useState } from 'react';

export default function GuestPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      setEmail(user?.email ?? null);
      setName(
        (user?.user_metadata?.nome as string) ||
          (user?.user_metadata?.full_name as string) ||
          (user?.user_metadata?.name as string) ||
          null,
      );
    });
  }, []);

  return (
    <GuestDashboard
      userEmail={email}
      userName={name}
      onSignOut={async () => {
        await supabase.auth.signOut();
        window.location.href = '/auth/login';
      }}
    />
  );
}
