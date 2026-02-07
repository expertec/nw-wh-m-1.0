'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Wifi, WifiOff, QrCode, Smartphone, Copy, Check, RefreshCw, Code2, Globe } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import type { TenantConfig, HashtagConfig } from '@/types';

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [waStatus, setWaStatus] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [showQR, setShowQR] = useState(false);

  const [config, setConfig] = useState<TenantConfig>({});
  const [hashtags, setHashtags] = useState<HashtagConfig>({ hashtagMap: {}, cancelByTrigger: {} });

  const [newHashtag, setNewHashtag] = useState('');
  const [newTrigger, setNewTrigger] = useState('');

  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');

  // Webhook config
  const [webhookConfig, setWebhookConfig] = useState<any>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    loadWebhookConfig();
    const interval = setInterval(loadWAStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [statusRes, configRes, hashtagsRes] = await Promise.all([
        api.get('/api/whatsapp/status'),
        api.get('/api/tenant-config'),
        api.get('/api/tenant-config/hashtags'),
      ]);
      setWaStatus(statusRes.data.status);
      setQrCode(statusRes.data.qr || '');
      setConfig(configRes.data.config || {});
      setHashtags(hashtagsRes.data.hashtags || { hashtagMap: {}, cancelByTrigger: {} });

      if (statusRes.data.status === 'Conectado') {
        const phoneRes = await api.get('/api/whatsapp/number');
        setPhoneNumber(phoneRes.data.phone || '');
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadWAStatus() {
    try {
      const res = await api.get('/api/whatsapp/status');
      setWaStatus(res.data.status);
      setQrCode(res.data.qr || '');
      if (res.data.status === 'Conectado' && !phoneNumber) {
        const phoneRes = await api.get('/api/whatsapp/number');
        setPhoneNumber(phoneRes.data.phone || '');
      }
    } catch {
      // silent
    }
  }

  async function loadWebhookConfig() {
    try {
      const res = await api.get('/api/webhook/config');
      setWebhookConfig(res.data);
    } catch (err) {
      console.error('Error loading webhook config:', err);
    }
  }

  async function handleGenerateApiKey() {
    try {
      setGeneratingKey(true);
      const res = await api.post('/api/webhook/generate-api-key');
      toast.success('API Key generada correctamente');
      await loadWebhookConfig();
    } catch (err) {
      toast.error('Error al generar API Key');
    } finally {
      setGeneratingKey(false);
    }
  }

  function copyToClipboard(text: string, fieldName: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`${fieldName} copiado`);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function handleConnect() {
    try {
      await api.post('/api/whatsapp/connect');
      toast.success('Iniciando conexión...');
      setTimeout(loadWAStatus, 2000);
    } catch {
      toast.error('Error al conectar');
    }
  }

  async function handleDisconnect() {
    try {
      await api.post('/api/whatsapp/disconnect');
      toast.success('Sesión desconectada. Conecta nuevamente para generar un nuevo QR.');
      setWaStatus('Desconectado');
      setQrCode('');
      setPhoneNumber('');
      setTimeout(loadWAStatus, 1000);
    } catch {
      toast.error('Error al desconectar');
    }
  }

  async function handleSendTest() {
    if (!testPhone || !testMessage) {
      toast.error('Ingresa un número y mensaje');
      return;
    }
    try {
      await api.post('/api/whatsapp/send-test-message', {
        telefono: testPhone,
        message: testMessage,
      });
      toast.success('Mensaje de prueba enviado');
      setTestPhone('');
      setTestMessage('');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Error al enviar mensaje';
      toast.error(errorMsg);
    }
  }

  async function handleSaveConfig() {
    try {
      await api.patch('/api/tenant-config', { config });
      toast.success('Configuración guardada');
    } catch {
      toast.error('Error al guardar');
    }
  }

  async function handleSaveHashtags() {
    try {
      await api.put('/api/tenant-config/hashtags', hashtags);
      toast.success('Hashtags guardados');
    } catch {
      toast.error('Error al guardar');
    }
  }

  function addHashtag() {
    if (!newHashtag || !newTrigger) return;
    setHashtags({
      ...hashtags,
      hashtagMap: { ...hashtags.hashtagMap, [newHashtag]: newTrigger },
    });
    setNewHashtag('');
    setNewTrigger('');
  }

  function removeHashtag(tag: string) {
    const { [tag]: _, ...rest } = hashtags.hashtagMap;
    setHashtags({ ...hashtags, hashtagMap: rest });
  }

  const isConnected = waStatus === 'Conectado';
  const hasQR = waStatus.includes('QR disponible') && qrCode;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Configuración</h1>

      <Tabs defaultValue="whatsapp" className="w-full">
        <TabsList>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          {isAdmin && <TabsTrigger value="forms">Formularios Web</TabsTrigger>}
          {isAdmin && <TabsTrigger value="config">Config</TabsTrigger>}
          {isAdmin && <TabsTrigger value="hashtags">Hashtags</TabsTrigger>}
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Conexión WhatsApp
              </CardTitle>
              <CardDescription>Estado de la conexión con WhatsApp Business</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isConnected ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
                  <span className="font-medium">Estado:</span>
                  <Badge variant={isConnected ? 'default' : 'secondary'}>{waStatus}</Badge>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    {!isConnected && (
                      <Button onClick={handleConnect}>Conectar WhatsApp</Button>
                    )}
                    {isConnected && (
                      <Button onClick={handleDisconnect} variant="destructive">
                        Desconectar
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {isConnected && phoneNumber && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm text-muted-foreground">Número conectado:</p>
                  <p className="font-mono font-semibold">{phoneNumber}</p>
                </div>
              )}

              {hasQR && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Escanea el código QR con WhatsApp</p>
                  <div className="flex gap-2">
                    <Button onClick={() => setShowQR(true)} variant="outline">
                      <QrCode className="h-4 w-4 mr-2" />
                      Ver código QR
                    </Button>
                    {isAdmin && (
                      <Button onClick={handleDisconnect} variant="ghost" size="sm">
                        Regenerar QR
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {isConnected && (
                <div className="space-y-3 pt-4 border-t">
                  <p className="font-medium text-sm">Enviar mensaje de prueba</p>
                  <div className="space-y-2">
                    <Input
                      placeholder="+52 1234567890"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                    />
                    <Input
                      placeholder="Mensaje de prueba"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                    />
                    <Button onClick={handleSendTest} className="w-full">
                      Enviar mensaje de prueba
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="forms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Formularios Web
                </CardTitle>
                <CardDescription>
                  Conecta formularios de tu sitio web al CRM. Los leads se capturan automáticamente y reciben WhatsApp.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!webhookConfig ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <>
                    {/* Tenant ID */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Tu Tenant ID</Label>
                      <div className="flex gap-2">
                        <Input
                          value={webhookConfig.tenantId || ''}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(webhookConfig.tenantId, 'Tenant ID')}
                        >
                          {copiedField === 'Tenant ID' ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* API Key */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">API Key (Seguridad)</Label>
                      {webhookConfig.hasApiKey ? (
                        <>
                          <div className="flex gap-2">
                            <Input
                              value={webhookConfig.apiKey || ''}
                              readOnly
                              className="font-mono text-sm"
                              type="password"
                              id="apiKeyInput"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                const input = document.getElementById('apiKeyInput') as HTMLInputElement;
                                input.type = input.type === 'password' ? 'text' : 'password';
                              }}
                              title="Mostrar/Ocultar"
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => copyToClipboard(webhookConfig.apiKey, 'API Key')}
                            >
                              {copiedField === 'API Key' ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateApiKey}
                            disabled={generatingKey}
                          >
                            {generatingKey ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Regenerando...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Regenerar API Key
                              </>
                            )}
                          </Button>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            No tienes API Key generada. Genera una para conectar tus formularios de forma segura.
                          </p>
                          <Button
                            onClick={handleGenerateApiKey}
                            disabled={generatingKey}
                          >
                            {generatingKey ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Generando...
                              </>
                            ) : (
                              'Generar API Key'
                            )}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Webhook URL */}
                    {webhookConfig.hasApiKey && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">URL del Webhook</Label>
                          <div className="flex gap-2">
                            <Input
                              value={webhookConfig.webhookUrl || ''}
                              readOnly
                              className="font-mono text-sm"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => copyToClipboard(webhookConfig.webhookUrl, 'URL')}
                            >
                              {copiedField === 'URL' ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Código de ejemplo */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <Code2 className="h-4 w-4" />
                            Código de Ejemplo (HTML + JavaScript)
                          </Label>
                          <div className="relative">
                            <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
{`<form id="contactForm">
  <input type="text" name="nombre" placeholder="Nombre" required>
  <input type="tel" name="telefono" placeholder="WhatsApp" required>
  <input type="email" name="email" placeholder="Email">
  <input type="text" name="ciudad" placeholder="Ciudad">
  <button type="submit">Enviar</button>
</form>

<script>
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = {
    tenantId: '${webhookConfig.tenantId}',
    apiKey: '${webhookConfig.apiKey}',
  };
  formData.forEach((value, key) => {
    if (value.trim()) data[key] = value.trim();
  });

  try {
    const res = await fetch('${webhookConfig.webhookUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
      alert('¡Gracias! Te contactaremos pronto.');
      e.target.reset();
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    alert('Error al enviar');
  }
});
</script>`}
                            </pre>
                            <Button
                              variant="outline"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => copyToClipboard(
                                `<form id="contactForm">
  <input type="text" name="nombre" placeholder="Nombre" required>
  <input type="tel" name="telefono" placeholder="WhatsApp" required>
  <input type="email" name="email" placeholder="Email">
  <input type="text" name="ciudad" placeholder="Ciudad">
  <button type="submit">Enviar</button>
</form>

<script>
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = {
    tenantId: '${webhookConfig.tenantId}',
    apiKey: '${webhookConfig.apiKey}',
  };
  formData.forEach((value, key) => {
    if (value.trim()) data[key] = value.trim();
  });

  try {
    const res = await fetch('${webhookConfig.webhookUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
      alert('¡Gracias! Te contactaremos pronto.');
      e.target.reset();
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    alert('Error al enviar');
  }
});
</script>`,
                                'Código'
                              )}
                            >
                              {copiedField === 'Código' ? (
                                <>
                                  <Check className="h-3 w-3 mr-1" />
                                  Copiado
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copiar
                                </>
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Instrucciones */}
                        <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 space-y-2">
                          <h4 className="font-medium text-sm">📋 Cómo usar:</h4>
                          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                            <li>Copia el código de ejemplo</li>
                            <li>Pégalo en tu sitio web (HTML)</li>
                            <li>Personaliza los campos según tu negocio</li>
                            <li>Los leads llegarán automáticamente al CRM</li>
                            <li>Se activará la secuencia configurada</li>
                          </ol>
                        </div>

                        {/* Campos personalizados */}
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 p-4 space-y-2">
                          <h4 className="font-medium text-sm">💡 Campos personalizados:</h4>
                          <p className="text-sm text-muted-foreground">
                            Puedes agregar cualquier campo adicional con <code className="bg-muted px-1 py-0.5 rounded">name="tuCampo"</code>
                            {' '}y se guardará automáticamente en el CRM.
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Ejemplos: <code className="bg-muted px-1 py-0.5 rounded">presupuesto</code>,{' '}
                            <code className="bg-muted px-1 py-0.5 rounded">tipoServicio</code>,{' '}
                            <code className="bg-muted px-1 py-0.5 rounded">urgencia</code>
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuración del Tenant</CardTitle>
                <CardDescription>Ajustes generales de secuencias y triggers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Trigger por defecto</Label>
                    <Input
                      value={config.defaultTrigger || ''}
                      onChange={(e) => setConfig({ ...config, defaultTrigger: e.target.value })}
                      placeholder="NuevoLeadWeb"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Trigger Meta Ads</Label>
                    <Input
                      value={config.defaultTriggerMetaAds || ''}
                      onChange={(e) => setConfig({ ...config, defaultTriggerMetaAds: e.target.value })}
                      placeholder="WebPromo"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveConfig}>Guardar configuración</Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="hashtags" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Mapeo de Hashtags</CardTitle>
                <CardDescription>Define qué secuencia se activa con cada hashtag</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Hashtag (ej: #WebPromo)"
                    value={newHashtag}
                    onChange={(e) => setNewHashtag(e.target.value)}
                  />
                  <Input
                    placeholder="Trigger (ej: WebPromo)"
                    value={newTrigger}
                    onChange={(e) => setNewTrigger(e.target.value)}
                  />
                  <Button onClick={addHashtag}>Agregar</Button>
                </div>

                {Object.keys(hashtags.hashtagMap).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay hashtags configurados</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(hashtags.hashtagMap).map(([tag, trigger]) => (
                      <div key={tag} className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <span className="font-medium">{tag}</span>
                          <span className="mx-2 text-muted-foreground">→</span>
                          <span className="text-muted-foreground">{trigger}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeHashtag(tag)}>
                          Eliminar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={handleSaveHashtags} className="w-full">Guardar hashtags</Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Código QR de WhatsApp</DialogTitle>
          </DialogHeader>
          {qrCode ? (
            <div className="flex justify-center p-4">
              <img src={qrCode} alt="QR Code" className="max-w-full" />
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No hay código QR disponible</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
