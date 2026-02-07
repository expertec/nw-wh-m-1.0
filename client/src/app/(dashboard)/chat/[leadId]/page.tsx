'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLeads } from '@/hooks/use-leads';
import { useMessages } from '@/hooks/use-messages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import { MessageSquare, SendHorizontal } from 'lucide-react';

export default function ChatLeadPage() {
  const params = useParams<{ leadId: string }>();
  const router = useRouter();
  const leadId = params?.leadId || '';
  const { leads, loading: leadsLoading } = useLeads();
  const { messages, loading: messagesLoading } = useMessages(leadId);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const selectedLead = useMemo(() => leads.find((l) => l.id === leadId), [leads, leadId]);

  useEffect(() => {
    if (!leadId) return;
    api.post('/api/whatsapp/mark-read', { leadId }).catch(() => {
      // No bloquear UI si falla
    });
  }, [leadId]);

  useEffect(() => {
    if (!messagesLoading && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messagesLoading]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await api.post('/api/whatsapp/send-message', { leadId, message: message.trim() });
      setMessage('');
    } catch {
      toast.error('Error al enviar mensaje');
    } finally {
      setSending(false);
    }
  }

  if (!leadId) {
    return (
      <div className="flex h-[calc(100vh-7rem)] items-center justify-center">
        <p className="text-muted-foreground">Selecciona un lead</p>
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-[280px_1fr] gap-4">
      <div className="rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Leads</h2>
        </div>
        <ScrollArea className="h-[calc(100vh-11rem)]">
          {leadsLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No hay leads</div>
          ) : (
            <div className="divide-y">
              {leads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/chat/${lead.id}`}
                  className={cn(
                    'flex items-center justify-between px-4 py-3 hover:bg-accent transition-colors',
                    lead.id === leadId && 'bg-accent'
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{lead.nombre || 'Sin nombre'}</p>
                    <p className="truncate text-xs text-muted-foreground">{lead.telefono}</p>
                  </div>
                  {lead.unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {lead.unreadCount}
                    </Badge>
                  )}
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex min-w-0 flex-col rounded-md border bg-card">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">
                {selectedLead?.nombre || 'Lead'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedLead?.telefono || 'Sin teléfono'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/leads')}>
              Ver lead
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {messagesLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-1/2" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="mx-auto mb-2 h-6 w-6" />
                <p className="text-sm">Aún no hay mensajes</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isBusiness = msg.sender === 'business';
                const isSystem = msg.sender === 'system';
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex',
                      isSystem ? 'justify-center' : isBusiness ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[70%] rounded-lg px-3 py-2 text-sm',
                        isSystem && 'bg-muted text-muted-foreground',
                        !isSystem && isBusiness && 'bg-primary text-primary-foreground',
                        !isSystem && !isBusiness && 'bg-accent'
                      )}
                    >
                      {msg.mediaType !== 'text' && msg.mediaUrl ? (
                        <div className="space-y-2">
                          {msg.mediaType === 'image' && (
                            <img src={msg.mediaUrl} alt="media" className="max-h-64 rounded" />
                          )}
                          {msg.mediaType === 'video' && (
                            <video src={msg.mediaUrl} controls className="max-h-64 w-full rounded" />
                          )}
                          {(msg.mediaType === 'audio' || msg.mediaType === 'audio_ptt') && (
                            <audio src={msg.mediaUrl} controls className="w-full" />
                          )}
                          {msg.mediaType === 'document' && (
                            <a
                              href={msg.mediaUrl}
                              className="text-xs underline"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir documento
                            </a>
                          )}
                          {msg.content && <p>{msg.content}</p>}
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                      <div className="mt-1 text-[10px] opacity-70">
                        {format(msg.timestamp, 'dd MMM HH:mm', { locale: es })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </ScrollArea>

        <form onSubmit={handleSend} className="border-t p-3">
          <div className="flex gap-2">
            <Input
              placeholder="Escribe un mensaje..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
            />
            <Button type="submit" disabled={sending || !message.trim()}>
              <SendHorizontal className="h-4 w-4 mr-2" />
              Enviar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
