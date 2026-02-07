'use client';

import { useEffect, useState } from 'react';
import { onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { messagesCol } from '@/lib/firestore';
import { useAuth } from '@/lib/auth-context';
import type { Message } from '@/types';

function toDate(v: unknown): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? new Date() : d;
}

function docToMessage(id: string, data: Record<string, unknown>): Message {
  return {
    id,
    content: (data.content as string) || '',
    mediaType: (data.mediaType as Message['mediaType']) || 'text',
    mediaUrl: (data.mediaUrl as string) || null,
    sender: (data.sender as Message['sender']) || 'lead',
    timestamp: toDate(data.timestamp),
  };
}

export function useMessages(leadId: string | null, maxResults = 100) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.tenantId || !leadId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const q = query(
      messagesCol(user.tenantId, leadId),
      orderBy('timestamp', 'asc'),
      limit(maxResults)
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => docToMessage(d.id, d.data() as Record<string, unknown>));
      setMessages(items);
      setLoading(false);
    }, (err) => {
      console.error('[useMessages] error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.tenantId, leadId, maxResults]);

  return { messages, loading };
}
