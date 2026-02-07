# Configuración de Google Calendar

Guía completa para configurar Google Calendar en el sistema de agentes IA.

## 📋 Requisitos Previos

1. Cuenta de Google Cloud Platform
2. Proyecto creado en Google Cloud Console
3. Variables de entorno configuradas en `.env`

---

## 🔧 Configuración en Google Cloud Console

### Paso 1: Crear Proyecto

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un nuevo proyecto o seleccionar uno existente
3. Nombre sugerido: "WhatsApp CRM Calendar"

### Paso 2: Habilitar Google Calendar API

1. En el menú lateral, ir a **APIs & Services > Library**
2. Buscar "Google Calendar API"
3. Click en **Enable**

### Paso 3: Crear Credenciales OAuth 2.0

1. Ir a **APIs & Services > Credentials**
2. Click en **Create Credentials > OAuth 2.0 Client ID**
3. Si es necesario, configurar la pantalla de consentimiento OAuth:
   - User Type: **External** (o Internal si es Google Workspace)
   - App name: "WhatsApp CRM"
   - User support email: tu email
   - Developer contact: tu email
   - Scopes: Agregar `https://www.googleapis.com/auth/calendar`
   - Test users: Agregar los emails que usarás para probar

4. Crear OAuth Client ID:
   - Application type: **Web application**
   - Name: "WhatsApp CRM Backend"
   - Authorized redirect URIs:
     - Development: `http://localhost:3001/api/integrations/google-calendar/callback`
     - Production: `https://tu-dominio.com/api/integrations/google-calendar/callback`

5. **Guardar Client ID y Client Secret**

### Paso 4: Configurar Variables de Entorno

Agregar a tu archivo `.env`:

```bash
# Google Calendar OAuth
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3001/api/integrations/google-calendar/callback

# Encryption Key (si no lo tienes)
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

---

## 🚀 Conectar Google Calendar (Flujo OAuth)

### Opción 1: Usando cURL (sin frontend)

**1. Obtener URL de autorización:**

```bash
curl -X GET http://localhost:3001/api/integrations/google-calendar/auth-url \
  -H "Authorization: Bearer <firebase-token>"
```

**Respuesta:**
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "instructions": "Abre esta URL en tu navegador para autorizar el acceso a Google Calendar"
}
```

**2. Abrir la URL en el navegador:**
- Copiar el `authUrl` de la respuesta
- Abrir en el navegador
- Iniciar sesión con tu cuenta de Google
- Autorizar el acceso al calendario
- Google te redirigirá a la URL de callback con un `code` en la URL

**3. Extraer el code del redirect:**
La URL será algo como:
```
http://localhost:3001/api/integrations/google-calendar/callback?code=4/0AY0e-g7X...&state=default
```

Copiar el valor del parámetro `code`

**4. Completar el flujo OAuth:**

```bash
curl -X POST http://localhost:3001/api/integrations/google-calendar/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "4/0AY0e-g7X...",
    "state": "default"
  }'
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "email": "admin@tuempresa.com",
  "message": "Google Calendar conectado exitosamente"
}
```

**5. Verificar conexión:**

```bash
curl -X GET http://localhost:3001/api/integrations/google-calendar/status \
  -H "Authorization: Bearer <firebase-token>"
```

**Respuesta:**
```json
{
  "success": true,
  "tenantId": "default",
  "connected": true,
  "email": "admin@tuempresa.com",
  "calendarId": "primary",
  "createdAt": "2024-02-07T...",
  "lastRefreshedAt": "2024-02-07T..."
}
```

### Opción 2: Usando Postman

1. **GET auth-url** → Copiar authUrl
2. Abrir authUrl en navegador → Autorizar
3. Copiar code del redirect
4. **POST callback** con el code
5. **GET status** para verificar

---

## 🔑 Habilitar el Tool de Calendar para el Agente IA

Una vez conectado Google Calendar, habilitar el tool:

```bash
curl -X PATCH http://localhost:3001/api/ai-agent/config \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "enabledTools": ["create_calendar_event"]
  }'
```

---

## 📝 Uso del Agente IA con Google Calendar

Una vez configurado, los usuarios pueden agendar citas directamente por WhatsApp:

**Ejemplos de mensajes:**

1. "Quiero agendar una cita para mañana a las 2pm"
2. "Agenda una visita al departamento para el viernes 10 a las 4pm"
3. "Necesito una reunión el 15 de febrero a las 10am"

**El agente IA:**
1. Detecta la intención de agendar
2. Extrae fecha, hora y título
3. Ejecuta el tool `create_calendar_event`
4. Crea el evento en Google Calendar
5. Responde con confirmación y link del evento

---

## 🧪 Pruebas

### Test 1: Verificar Conexión

```bash
curl -X GET http://localhost:3001/api/integrations/google-calendar/calendars \
  -H "Authorization: Bearer <token>"
```

Debe retornar lista de calendarios disponibles.

### Test 2: Listar Eventos

```bash
curl -X GET "http://localhost:3001/api/integrations/google-calendar/events?maxResults=5" \
  -H "Authorization: Bearer <token>"
```

### Test 3: Agendar Cita con el Agente

```bash
curl -X POST http://localhost:3001/api/ai-agent/test \
  -H "Authorization: Bearer <token>" \
  -d '{
    "message": "Quiero agendar una cita mañana a las 2pm"
  }'
```

El agente debe responder confirmando la cita y proporcionando el link.

---

## 🔄 Mantenimiento

### Refrescar Access Token Manualmente

```bash
curl -X POST http://localhost:3001/api/integrations/google-calendar/refresh \
  -H "Authorization: Bearer <token>"
```

(Normalmente no es necesario, el sistema refresca automáticamente)

### Desconectar Google Calendar

```bash
curl -X DELETE http://localhost:3001/api/integrations/google-calendar \
  -H "Authorization: Bearer <token>"
```

---

## 🐛 Troubleshooting

### Error: "No se recibió refresh_token"

**Solución:** Asegúrate de que la URL de autorización incluye `prompt=consent`. El sistema lo hace automáticamente.

### Error: "redirect_uri_mismatch"

**Solución:**
1. Verifica que `GOOGLE_REDIRECT_URI` en `.env` coincide exactamente con la URI configurada en Google Cloud Console
2. Incluye `/api/integrations/google-calendar/callback` al final
3. No olvides el protocolo (`http://` o `https://`)

### Error: "Access token expired"

**Solución:** El sistema refresca automáticamente. Si persiste:
```bash
curl -X POST .../google-calendar/refresh -H "Authorization: ..."
```

### Error: "invalid_grant"

**Solución:** El refresh token expiró o fue revocado. Reconectar Google Calendar:
1. DELETE para desconectar
2. Repetir flujo OAuth completo

---

## 🔒 Seguridad

- ✅ Tokens encriptados con AES-256-GCM
- ✅ Clave derivada por tenant (aislamiento multi-tenant)
- ✅ Access tokens refrescados automáticamente
- ✅ Refresh tokens almacenados de forma segura
- ✅ Solo roles admin/superadmin pueden conectar/desconectar

---

## 📚 Recursos

- [Google Calendar API Documentation](https://developers.google.com/calendar/api/guides/overview)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Calendar API Quickstart](https://developers.google.com/calendar/api/quickstart/nodejs)
