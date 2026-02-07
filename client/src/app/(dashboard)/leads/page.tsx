'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLeads } from '@/hooks/use-leads';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare, Pause, Zap, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function LeadsPage() {
  const { leads, loading } = useLeads();
  const [search, setSearch] = useState('');

  const filtered = leads.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (l.nombre || '').toLowerCase().includes(s) || (l.telefono || '').includes(s);
  });

  async function togglePause(leadId: string, isPaused: boolean) {
    try {
      if (isPaused) {
        await api.post(`/api/leads/${leadId}/resume`);
        toast.success('Secuencias reanudadas');
      } else {
        await api.post(`/api/leads/${leadId}/pause`);
        toast.success('Secuencias pausadas');
      }
    } catch {
      toast.error('Error al cambiar estado de secuencias');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Etiquetas</TableHead>
                <TableHead>Sin leer</TableHead>
                <TableHead>Último mensaje</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No se encontraron leads
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.nombre || 'Sin nombre'}</TableCell>
                    <TableCell className="font-mono text-sm">{lead.telefono}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{lead.estado}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {lead.etiquetas.slice(0, 3).map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                        ))}
                        {lead.etiquetas.length > 3 && (
                          <Badge variant="secondary" className="text-xs">+{lead.etiquetas.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {lead.unreadCount > 0 && (
                        <Badge variant="destructive">{lead.unreadCount}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.lastMessageAt
                        ? formatDistanceToNow(lead.lastMessageAt, { addSuffix: true, locale: es })
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" asChild title="Chat">
                          <Link href={`/chat/${lead.id}`}>
                            <MessageSquare className="h-4 w-4" />
                          </Link>
                        </Button>
                        {lead.hasActiveSequences && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={lead.seqPaused ? 'Reanudar' : 'Pausar'}
                            onClick={() => togglePause(lead.id, lead.seqPaused)}
                          >
                            {lead.seqPaused ? <Zap className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
