'use client';

import { useEffect, useState } from 'react';
import { onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { leadsCol } from '@/lib/firestore';
import { useAuth } from '@/lib/auth-context';
import type { Lead } from '@/types';

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? null : d;
}

function docToLead(id: string, data: Record<string, unknown>): Lead {
  return {
    id,
    telefono: (data.telefono as string) || '',
    nombre: (data.nombre as string) || '',
    jid: (data.jid as string) || '',
    resolvedJid: data.resolvedJid as string | undefined,
    estado: (data.estado as string) || 'nuevo',
    etiquetas: Array.isArray(data.etiquetas) ? data.etiquetas : [],
    lastMessageAt: toDate(data.lastMessageAt),
    fecha_creacion: toDate(data.fecha_creacion),
    unreadCount: Number(data.unreadCount) || 0,
    hasActiveSequences: !!data.hasActiveSequences,
    seqPaused: !!data.seqPaused,
    secuenciasActivas: Array.isArray(data.secuenciasActivas) ? data.secuenciasActivas : [],
  };
}

interface UseLeadsOptions {
  maxResults?: number;
  filterEstado?: string;
}

export function useLeads(options: UseLeadsOptions = {}) {
  const { maxResults = 200, filterEstado } = options;
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.tenantId) return;

    const constraints = [orderBy('lastMessageAt', 'desc'), limit(maxResults)];
    if (filterEstado) {
      constraints.unshift(where('estado', '==', filterEstado));
    }

    const q = query(leadsCol(user.tenantId), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => docToLead(d.id, d.data() as Record<string, unknown>));
      setLeads(items);
      setLoading(false);
    }, (err) => {
      console.error('[useLeads] error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.tenantId, maxResults, filterEstado]);

  return { leads, loading };
}
