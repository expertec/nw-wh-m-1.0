'use client';

import { useEffect, useState } from 'react';
import { onSnapshot, query } from 'firebase/firestore';
import { secuenciasCol } from '@/lib/firestore';
import { useAuth } from '@/lib/auth-context';
import type { Sequence } from '@/types';

function docToSequence(id: string, data: Record<string, unknown>): Sequence {
  return {
    id,
    trigger: (data.trigger as string) || id,
    active: data.active !== false,
    messages: Array.isArray(data.messages) ? data.messages : [],
  };
}

export function useSequences() {
  const { user } = useAuth();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.tenantId) return;

    const q = query(secuenciasCol(user.tenantId));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => docToSequence(d.id, d.data() as Record<string, unknown>));
      setSequences(items);
      setLoading(false);
    }, (err) => {
      console.error('[useSequences] error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.tenantId]);

  return { sequences, loading };
}
