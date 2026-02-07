'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Plus, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { Tenant } from '@/types';

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate();
  }
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? null : d;
}

export default function TenantsPage() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [newId, setNewId] = useState('');
  const [newNombre, setNewNombre] = useState('');
  const [newPlan, setNewPlan] = useState('basico');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [createdUserInfo, setCreatedUserInfo] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (user?.role !== 'superadmin') return;
    loadTenants();
  }, [user]);

  async function loadTenants() {
    try {
      const res = await api.get('/api/tenants');
      setTenants(res.data.tenants || []);
    } catch (err) {
      console.error('Error loading tenants:', err);
      toast.error('Error al cargar tenants');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newId || !newNombre) {
      toast.error('ID y nombre son requeridos');
      return;
    }
    try {
      const res = await api.post('/api/tenants', {
        id: newId,
        nombre: newNombre,
        plan: newPlan,
        ownerEmail: newEmail || null,
        ownerPassword: newPassword || null,
      });
      toast.success('Tenant creado');

      // Si hubo un error creando el usuario, mostrarlo
      if (res.data.userCreationError) {
        toast.error(`Error creando usuario: ${res.data.userCreationError}`);
      }

      // Si se creó un usuario, guardar la info para mostrarla
      if (res.data.createdUser) {
        setCreatedUserInfo({
          email: res.data.createdUser.email,
          password: res.data.createdUser.password || '(establecida por ti)',
        });
      }

      setCreating(false);
      setNewId('');
      setNewNombre('');
      setNewPlan('basico');
      setNewEmail('');
      setNewPassword('');
      loadTenants();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear tenant';
      toast.error(msg);
    }
  }

  async function toggleDisabled(id: string, currentDisabled: boolean) {
    try {
      await api.patch(`/api/tenants/${id}`, { disabled: !currentDisabled });
      toast.success(currentDisabled ? 'Tenant habilitado' : 'Tenant deshabilitado');
      loadTenants();
    } catch {
      toast.error('Error al actualizar');
    }
  }

  if (user?.role !== 'superadmin') {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Solo superadmin puede ver esta página</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Gestión de Tenants</h1>
        </div>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Tenant</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Tenant</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ID (único, sin espacios)</Label>
                <Input
                  value={newId}
                  onChange={(e) => setNewId(e.target.value.toLowerCase().replace(/\s/g, '-'))}
                  placeholder="empresa-demo"
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  placeholder="Empresa Demo S.A."
                />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={newPlan} onValueChange={setNewPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basico">Básico</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Email del owner (opcional)</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="admin@empresa.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Contraseña (opcional, se generará automáticamente si no se proporciona)</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Dejar vacío para auto-generar"
                  disabled={!newEmail}
                />
                {!newEmail && (
                  <p className="text-xs text-muted-foreground">Ingresa un email primero</p>
                )}
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!newId || !newNombre}>
                Crear Tenant
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenants ({tenants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No hay tenants configurados
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-mono text-sm">{tenant.id}</TableCell>
                    <TableCell className="font-medium">{tenant.nombre}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{tenant.plan}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tenant.ownerEmail || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={tenant.disabled ? 'destructive' : 'default'}
                        className="cursor-pointer"
                        onClick={() => toggleDisabled(tenant.id, tenant.disabled)}
                      >
                        {tenant.disabled ? 'Deshabilitado' : 'Activo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(() => {
                        const date = toDate(tenant.createdAt);
                        return date ? format(date, 'dd MMM yyyy', { locale: es }) : '-';
                      })()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" title="Configurar">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!createdUserInfo} onOpenChange={(open) => !open && setCreatedUserInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuario Administrador Creado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se ha creado una cuenta de administrador para este tenant. Guarda estas credenciales:
            </p>
            <div className="rounded-md border bg-muted p-4 space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="font-mono text-sm font-semibold">{createdUserInfo?.email}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Contraseña</Label>
                <p className="font-mono text-sm font-semibold">{createdUserInfo?.password}</p>
              </div>
            </div>
            <p className="text-xs text-amber-600">
              ⚠️ Guarda esta contraseña ahora. No se mostrará nuevamente.
            </p>
            <Button onClick={() => setCreatedUserInfo(null)} className="w-full">
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
