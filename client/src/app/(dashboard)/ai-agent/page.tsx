'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Bot, Calendar, Settings, TrendingUp, Loader2, Check, X, Sparkles } from 'lucide-react';

interface AIAgentConfig {
  enabled: boolean;
  model: string;
  personality: {
    systemPrompt: string;
    tone: string;
    language: string;
  };
  businessContext: {
    companyName: string;
    services: string[];
    schedule: string;
    description?: string;
  };
  enabledTools: string[];
  rateLimits: {
    maxMessagesPerLeadPerDay: number;
    maxToolCallsPerDay: number;
  };
  fallbackBehavior: {
    onError: string;
    defaultTrigger: string;
  };
}

interface CalendarStatus {
  connected: boolean;
  email?: string;
  calendarId?: string;
  createdAt?: string;
  lastRefreshedAt?: string;
}

interface Stats {
  date: string;
  messagesProcessed: number;
  toolCallsExecuted: number;
  tokensUsed: number;
  estimatedCost: number;
}

export default function AIAgentPage() {
  const [config, setConfig] = useState<AIAgentConfig | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testing, setTesting] = useState(false);

  // Cargar configuración inicial
  useEffect(() => {
    loadConfig();
    loadCalendarStatus();
    loadStats();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await api.get('/api/ai-agent/config');
      setConfig(data.config);
    } catch (error: any) {
      toast.error('Error cargando configuración');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarStatus = async () => {
    try {
      const { data } = await api.get('/api/integrations/google-calendar/status');
      setCalendarStatus(data);
    } catch (error: any) {
      console.error('Error cargando estado de Calendar:', error);
      // Si hay error (ej: Calendar no configurado), asumir que no está conectado
      setCalendarStatus({
        success: true,
        connected: false,
        message: 'Google Calendar no está conectado'
      });
    }
  };

  const loadStats = async () => {
    try {
      const { data } = await api.get('/api/ai-agent/stats');
      setStats(data.stats);
    } catch (error: any) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await api.patch('/api/ai-agent/config', { config });
      toast.success('Configuración guardada exitosamente');
      loadStats(); // Recargar stats después de guardar
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error guardando configuración');
    } finally {
      setSaving(false);
    }
  };

  const connectGoogleCalendar = async () => {
    setConnectingCalendar(true);
    try {
      const { data } = await api.get('/api/integrations/google-calendar/auth-url');

      // Abrir ventana de autorización
      const width = 600;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;

      const authWindow = window.open(
        data.authUrl,
        'Google Calendar Authorization',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Escuchar cuando se cierre la ventana
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          setConnectingCalendar(false);
          loadCalendarStatus(); // Recargar estado
        }
      }, 500);

      toast.info('Autoriza el acceso a Google Calendar en la ventana emergente');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error conectando Google Calendar');
      setConnectingCalendar(false);
    }
  };

  const disconnectGoogleCalendar = async () => {
    if (!confirm('¿Estás seguro de desconectar Google Calendar?')) return;

    try {
      await api.delete('/api/integrations/google-calendar');
      toast.success('Google Calendar desconectado');
      loadCalendarStatus();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error desconectando');
    }
  };

  const testAgent = async () => {
    if (!testMessage.trim()) {
      toast.error('Escribe un mensaje de prueba');
      return;
    }

    setTesting(true);
    setTestResponse('');

    try {
      const { data } = await api.post('/api/ai-agent/test', {
        message: testMessage
      });

      setTestResponse(data.result.response);
      toast.success('Prueba completada');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error probando agente');
      setTestResponse('Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setTesting(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-8 w-8" />
          Agente IA
        </h1>
        <p className="text-muted-foreground">
          Configura tu asistente virtual inteligente con GPT-4o
        </p>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="h-4 w-4 mr-2" />
            Google Calendar
          </TabsTrigger>
          <TabsTrigger value="stats">
            <TrendingUp className="h-4 w-4 mr-2" />
            Estadísticas
          </TabsTrigger>
          <TabsTrigger value="test">
            <Sparkles className="h-4 w-4 mr-2" />
            Probar
          </TabsTrigger>
        </TabsList>

        {/* Tab: Configuración */}
        <TabsContent value="config" className="space-y-4">
          {/* Estado del Agente */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Estado del Agente</CardTitle>
                  <CardDescription>Habilitar o deshabilitar el agente IA</CardDescription>
                </div>
                <Badge variant={config.enabled ? 'default' : 'secondary'}>
                  {config.enabled ? <Check className="h-4 w-4 mr-1" /> : <X className="h-4 w-4 mr-1" />}
                  {config.enabled ? 'Habilitado' : 'Deshabilitado'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant={config.enabled ? 'destructive' : 'default'}
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              >
                {config.enabled ? 'Deshabilitar Agente' : 'Habilitar Agente'}
              </Button>
            </CardContent>
          </Card>

          {/* Personalidad */}
          <Card>
            <CardHeader>
              <CardTitle>Personalidad del Agente</CardTitle>
              <CardDescription>Define cómo se comporta y comunica el agente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="model">Modelo de IA</Label>
                <Select
                  value={config.model}
                  onValueChange={(value) => setConfig({ ...config, model: value })}
                >
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o (Recomendado)</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Económico)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  value={config.personality.systemPrompt}
                  onChange={(e) => setConfig({
                    ...config,
                    personality: { ...config.personality, systemPrompt: e.target.value }
                  })}
                  rows={4}
                  placeholder="Eres un asistente de ventas profesional para..."
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Define el rol y comportamiento del agente
                </p>
              </div>

              <div>
                <Label htmlFor="tone">Tono de Comunicación</Label>
                <Select
                  value={config.personality.tone}
                  onValueChange={(value) => setConfig({
                    ...config,
                    personality: { ...config.personality, tone: value }
                  })}
                >
                  <SelectTrigger id="tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profesional">Profesional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="técnico">Técnico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Contexto del Negocio */}
          <Card>
            <CardHeader>
              <CardTitle>Contexto del Negocio</CardTitle>
              <CardDescription>Información sobre tu empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="companyName">Nombre de la Empresa</Label>
                <Input
                  id="companyName"
                  value={config.businessContext.companyName}
                  onChange={(e) => setConfig({
                    ...config,
                    businessContext: { ...config.businessContext, companyName: e.target.value }
                  })}
                  placeholder="Mi Empresa S.A."
                />
              </div>

              <div>
                <Label htmlFor="services">Servicios (separados por coma)</Label>
                <Input
                  id="services"
                  value={config.businessContext.services.join(', ')}
                  onChange={(e) => setConfig({
                    ...config,
                    businessContext: {
                      ...config.businessContext,
                      services: e.target.value.split(',').map(s => s.trim())
                    }
                  })}
                  placeholder="Servicio 1, Servicio 2, Servicio 3"
                />
              </div>

              <div>
                <Label htmlFor="schedule">Horario de Atención</Label>
                <Input
                  id="schedule"
                  value={config.businessContext.schedule}
                  onChange={(e) => setConfig({
                    ...config,
                    businessContext: { ...config.businessContext, schedule: e.target.value }
                  })}
                  placeholder="9am-6pm Lun-Vie"
                />
              </div>

              <div>
                <Label htmlFor="description">Descripción (Opcional)</Label>
                <Textarea
                  id="description"
                  value={config.businessContext.description || ''}
                  onChange={(e) => setConfig({
                    ...config,
                    businessContext: { ...config.businessContext, description: e.target.value }
                  })}
                  rows={3}
                  placeholder="Descripción adicional de tu negocio..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Tools Habilitados */}
          <Card>
            <CardHeader>
              <CardTitle>Herramientas (Tools)</CardTitle>
              <CardDescription>Acciones que el agente puede ejecutar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Google Calendar</p>
                  <p className="text-sm text-muted-foreground">Agendar citas automáticamente</p>
                </div>
                <Button
                  variant={config.enabledTools.includes('create_calendar_event') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const tools = config.enabledTools.includes('create_calendar_event')
                      ? config.enabledTools.filter(t => t !== 'create_calendar_event')
                      : [...config.enabledTools, 'create_calendar_event'];
                    setConfig({ ...config, enabledTools: tools });
                  }}
                >
                  {config.enabledTools.includes('create_calendar_event') ? 'Habilitado' : 'Deshabilitado'}
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Echo (Testing)</p>
                  <p className="text-sm text-muted-foreground">Herramienta de prueba</p>
                </div>
                <Button
                  variant={config.enabledTools.includes('echo') ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    const tools = config.enabledTools.includes('echo')
                      ? config.enabledTools.filter(t => t !== 'echo')
                      : [...config.enabledTools, 'echo'];
                    setConfig({ ...config, enabledTools: tools });
                  }}
                >
                  {config.enabledTools.includes('echo') ? 'Habilitado' : 'Deshabilitado'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Rate Limits */}
          <Card>
            <CardHeader>
              <CardTitle>Límites de Uso</CardTitle>
              <CardDescription>Control de costos y prevención de abuso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="maxMessages">Máximo mensajes por lead por día</Label>
                <Input
                  id="maxMessages"
                  type="number"
                  value={config.rateLimits.maxMessagesPerLeadPerDay}
                  onChange={(e) => setConfig({
                    ...config,
                    rateLimits: {
                      ...config.rateLimits,
                      maxMessagesPerLeadPerDay: parseInt(e.target.value) || 0
                    }
                  })}
                />
              </div>

              <div>
                <Label htmlFor="maxToolCalls">Máximo tool calls por día</Label>
                <Input
                  id="maxToolCalls"
                  type="number"
                  value={config.rateLimits.maxToolCallsPerDay}
                  onChange={(e) => setConfig({
                    ...config,
                    rateLimits: {
                      ...config.rateLimits,
                      maxToolCallsPerDay: parseInt(e.target.value) || 0
                    }
                  })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botón Guardar */}
          <div className="flex justify-end">
            <Button onClick={saveConfig} disabled={saving} size="lg">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar Configuración
            </Button>
          </div>
        </TabsContent>

        {/* Tab: Google Calendar */}
        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integración con Google Calendar</CardTitle>
              <CardDescription>
                Conecta tu cuenta de Google para que el agente pueda agendar citas automáticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {calendarStatus?.connected ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Conectado
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <p><strong>Email:</strong> {calendarStatus.email}</p>
                    <p><strong>Calendario:</strong> {calendarStatus.calendarId}</p>
                    <p className="text-sm text-muted-foreground">
                      Conectado el {new Date(calendarStatus.createdAt!).toLocaleDateString()}
                    </p>
                  </div>

                  <Button variant="destructive" onClick={disconnectGoogleCalendar}>
                    Desconectar Google Calendar
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <X className="h-3 w-3" />
                      No conectado
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Para habilitar la función de agendar citas automáticamente, conecta tu cuenta de Google Calendar.
                  </p>

                  <Button
                    onClick={connectGoogleCalendar}
                    disabled={connectingCalendar}
                  >
                    {connectingCalendar && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Conectar Google Calendar
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Estadísticas */}
        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mensajes Procesados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.messagesProcessed || 0}</div>
                <p className="text-xs text-muted-foreground">Hoy</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tool Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.toolCallsExecuted || 0}</div>
                <p className="text-xs text-muted-foreground">Acciones ejecutadas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tokens Usados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.tokensUsed?.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">Hoy</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Costo Estimado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats?.estimatedCost?.toFixed(4) || '0.00'}</div>
                <p className="text-xs text-muted-foreground">USD hoy</p>
              </CardContent>
            </Card>
          </div>

          <Button onClick={loadStats} variant="outline">
            Refrescar Estadísticas
          </Button>
        </TabsContent>

        {/* Tab: Probar */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Probar Agente IA</CardTitle>
              <CardDescription>
                Envía un mensaje de prueba para ver cómo responde el agente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="testMessage">Mensaje de Prueba</Label>
                <Textarea
                  id="testMessage"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  rows={3}
                  placeholder="Ej: Hola, quiero información sobre sus servicios"
                />
              </div>

              <Button onClick={testAgent} disabled={testing}>
                {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar Prueba
              </Button>

              {testResponse && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="font-medium mb-2">Respuesta del Agente:</p>
                  <p className="whitespace-pre-wrap">{testResponse}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
