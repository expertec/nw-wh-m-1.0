'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Plus, Trash2, Save, GripVertical } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { SequenceStep } from '@/types';

const STEP_TYPES: { value: SequenceStep['type']; label: string }[] = [
  { value: 'texto', label: 'Texto' },
  { value: 'imagen', label: 'Imagen' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'videonota', label: 'Video Nota (PTV)' },
  { value: 'formulario', label: 'Formulario' },
];

export default function SequenceEditorPage() {
  const params = useParams();
  const seqId = params.id as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trigger, setTrigger] = useState('');
  const [active, setActive] = useState(true);
  const [steps, setSteps] = useState<SequenceStep[]>([]);

  useEffect(() => {
    api.get(`/api/sequences/${seqId}`)
      .then(r => {
        setTrigger(r.data.trigger || '');
        setActive(r.data.active !== false);
        setSteps(Array.isArray(r.data.messages) ? r.data.messages : []);
      })
      .catch(() => toast.error('Error cargando secuencia'))
      .finally(() => setLoading(false));
  }, [seqId]);

  function addStep() {
    setSteps([...steps, { type: 'texto', contenido: '', delay: 0 }]);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function updateStep(index: number, field: string, value: unknown) {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/api/sequences/${seqId}`, { trigger, active, messages: steps });
      toast.success('Secuencia guardada');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/sequences"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold">Editar: {seqId}</h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Input value={trigger} onChange={(e) => setTrigger(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={active ? 'true' : 'false'} onValueChange={(v) => setActive(v === 'true')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Activa</SelectItem>
                  <SelectItem value="false">Inactiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pasos ({steps.length})</h2>
        <Button variant="outline" onClick={addStep}><Plus className="h-4 w-4 mr-2" />Agregar paso</Button>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Paso {i + 1}</CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeStep(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={step.type} onValueChange={(v) => updateStep(i, 'type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STEP_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Delay (minutos)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={step.delay}
                    onChange={(e) => updateStep(i, 'delay', +e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Contenido {step.type !== 'texto' && step.type !== 'formulario' ? '(URL)' : ''}</Label>
                <Textarea
                  value={step.contenido}
                  onChange={(e) => updateStep(i, 'contenido', e.target.value)}
                  placeholder={step.type === 'texto' ? 'Hola {{nombre}}, ...' : 'https://...'}
                  rows={step.type === 'texto' || step.type === 'formulario' ? 3 : 1}
                />
              </div>
              {(step.type === 'imagen' || step.type === 'video') && (
                <div className="space-y-2">
                  <Label>Caption (opcional)</Label>
                  <Input
                    value={step.caption || ''}
                    onChange={(e) => updateStep(i, 'caption', e.target.value)}
                  />
                </div>
              )}
              {step.type === 'videonota' && (
                <div className="space-y-2">
                  <Label>Duración (segundos, opcional)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={step.seconds || ''}
                    onChange={(e) => updateStep(i, 'seconds', +e.target.value || undefined)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 pt-4">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />{saving ? 'Guardando...' : 'Guardar secuencia'}
        </Button>
        <Button variant="outline" onClick={() => router.push('/sequences')}>Cancelar</Button>
      </div>
    </div>
  );
}
