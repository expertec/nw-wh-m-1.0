'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Zap, MessageSquare, Wifi, WifiOff } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface Stats {
  totalLeads: number;
  nuevosHoy: number;
  conSecuenciaActiva: number;
  sinLeer: number;
  whatsappStatus: string;
}

export default function DashboardPage() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !firebaseUser) return;

    setLoading(true);
    api.get('/api/dashboard/stats')
      .then((r) => setStats(r.data))
      .catch((err) => console.error('Error cargando stats:', err))
      .finally(() => setLoading(false));
  }, [authLoading, firebaseUser]);

  const cards = [
    { title: 'Total Leads', value: stats?.totalLeads ?? '-', icon: Users, color: 'text-blue-500' },
    { title: 'Nuevos hoy', value: stats?.nuevosHoy ?? '-', icon: UserPlus, color: 'text-green-500' },
    { title: 'Secuencias activas', value: stats?.conSecuenciaActiva ?? '-', icon: Zap, color: 'text-orange-500' },
    { title: 'Sin leer', value: stats?.sinLeer ?? '-', icon: MessageSquare, color: 'text-red-500' },
  ];

  const isConnected = stats?.whatsappStatus === 'Conectado';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Badge variant={isConnected ? 'default' : 'destructive'} className="flex items-center gap-1">
          {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          WhatsApp: {stats?.whatsappStatus ?? 'Cargando...'}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '...' : card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
