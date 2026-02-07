'use client';

import { useLeads } from '@/hooks/use-leads';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ChatIndexPage() {
  const { leads, loading } = useLeads();
  const router = useRouter();

  useEffect(() => {
    if (!loading && leads.length > 0) {
      router.replace(`/chat/${leads[0].id}`);
    }
  }, [leads, loading, router]);

  return (
    <div className="flex h-[calc(100vh-7rem)] items-center justify-center">
      {loading ? (
        <Skeleton className="h-8 w-48" />
      ) : leads.length === 0 ? (
        <p className="text-muted-foreground">No hay leads aún</p>
      ) : (
        <p className="text-muted-foreground">Redirigiendo...</p>
      )}
    </div>
  );
}
