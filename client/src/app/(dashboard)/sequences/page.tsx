'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSequences } from '@/hooks/use-sequences';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function SequencesPage() {
  const { sequences, loading } = useSequences();
  const [creating, setCreating] = useState(false);
  const [newId, setNewId] = useState('');
  const [newTrigger, setNewTrigger] = useState('');

  async function handleCreate() {
    if (!newId || !newTrigger) return;
    try {
      await api.post('/api/sequences', { id: newId, trigger: newTrigger, active: true, messages: [] });
      toast.success('Secuencia creada');
      setCreating(false);
      setNewId('');
      setNewTrigger('');
    } catch {
      toast.error('Error al crear secuencia');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta secuencia?')) return;
    try {
      await api.delete(`/api/sequences/${id}`);
      toast.success('Secuencia eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  }

  async function handleToggle(id: string, currentActive: boolean) {
    try {
      await api.put(`/api/sequences/${id}`, { active: !currentActive });
      toast.success(currentActive ? 'Secuencia desactivada' : 'Secuencia activada');
    } catch {
      toast.error('Error al cambiar estado');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Secuencias</h1>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nueva secuencia</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear secuencia</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ID (nombre único)</Label>
                <Input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="Ej: NuevoLeadWeb" />
              </div>
              <div className="space-y-2">
                <Label>Trigger</Label>
                <Input value={newTrigger} onChange={(e) => setNewTrigger(e.target.value)} placeholder="Ej: NuevoLeadWeb" />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!newId || !newTrigger}>
                Crear
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Mensajes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sequences.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No hay secuencias configuradas
                  </TableCell>
                </TableRow>
              ) : (
                sequences.map((seq) => (
                  <TableRow key={seq.id}>
                    <TableCell className="font-medium">{seq.id}</TableCell>
                    <TableCell>{seq.trigger}</TableCell>
                    <TableCell>{seq.messages.length} pasos</TableCell>
                    <TableCell>
                      <Badge
                        variant={seq.active ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => handleToggle(seq.id, seq.active)}
                      >
                        {seq.active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" asChild title="Editar">
                          <Link href={`/sequences/${seq.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" title="Eliminar" onClick={() => handleDelete(seq.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
