# Sistema de Agentes IA - WhatsApp CRM

Sistema completo de agentes IA conversacionales con GPT-4o y Google Calendar integration.

## 🎯 Características

✅ **Agentes IA Personalizados por Tenant**
- Personalidad y tono configurable
- Contexto del negocio
- System prompts personalizados

✅ **Conversaciones Inteligentes**
- Historial conversacional (20 mensajes)
- Comprensión de contexto
- Respuestas dinámicas y naturales

✅ **Sistema de Tools (Acciones)**
- Agendar citas en Google Calendar
- Arquitectura modular para agregar más tools
- Validación y rate limiting

✅ **Multi-Tenant**
- Configuración independiente por negocio
- Encriptación de credenciales por tenant
- Rate limiting separado

✅ **Seguridad**
- Tokens OAuth encriptados con AES-256-GCM
- Control de costos por tenant
- Fallbacks en caso de errores

---

## 📦 Instalación

### 1. Instalar Dependencias

```bash
cd server
npm install
```

**Nuevas dependencias agregadas:**
- `openai` - Cliente OpenAI GPT-4o
- `googleapis` - Cliente Google Calendar API

### 2. Configurar Variables de Entorno

Copiar `.env.example` a `.env` y configurar:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Encryption (generar nueva clave)
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Google Calendar (Fase 4)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:3001/api/integrations/google-calendar/callback
```

### 3. Iniciar Servidor

```bash
npm start
```

---

## 🚀 Configuración Rápida

### Paso 1: Habilitar Agente IA

```bash
curl -X PATCH http://localhost:3001/api/ai-agent/config \
  -H "Authorization: Bearer <firebase-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "model": "gpt-4o",
    "personality": {
      "systemPrompt": "Eres un asistente de ventas profesional para [TU NEGOCIO].",
      "tone": "profesional",
      "language": "es"
    },
    "businessContext": {
      "companyName": "Mi Empresa",
      "services": ["Servicio 1", "Servicio 2"],
      "schedule": "9am-6pm Lun-Vie"
    },
    "enabledTools": ["create_calendar_event"],
    "rateLimits": {
      "maxMessagesPerLeadPerDay": 50,
      "maxToolCallsPerDay": 100
    }
  }'
```

### Paso 2: Conectar Google Calendar

Seguir la guía completa en: [GOOGLE_CALENDAR_SETUP.md](./GOOGLE_CALENDAR_SETUP.md)

**Resumen:**
1. Obtener URL de autorización
2. Autorizar en navegador
3. Completar callback con el code
4. Verificar estado de conexión

### Paso 3: Probar el Agente

```bash
curl -X POST http://localhost:3001/api/ai-agent/test \
  -H "Authorization: Bearer <token>" \
  -d '{
    "message": "Hola, quiero información sobre sus servicios"
  }'
```

---

## 📚 Endpoints API

### Configuración del Agente

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| GET | `/api/ai-agent/config` | Obtener configuración | todos |
| PATCH | `/api/ai-agent/config` | Actualizar configuración | admin, superadmin |
| POST | `/api/ai-agent/test` | Enviar mensaje de prueba | admin, superadmin |
| GET | `/api/ai-agent/stats` | Estadísticas de uso | todos |

### Google Calendar

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| GET | `/api/integrations/google-calendar/auth-url` | URL de autorización OAuth | admin, superadmin |
| POST | `/api/integrations/google-calendar/callback` | Callback OAuth | público |
| GET | `/api/integrations/google-calendar/status` | Estado de conexión | admin, superadmin |
| POST | `/api/integrations/google-calendar/refresh` | Refrescar token | admin, superadmin |
| DELETE | `/api/integrations/google-calendar` | Desconectar | admin, superadmin |
| GET | `/api/integrations/google-calendar/calendars` | Listar calendarios | admin, superadmin |
| GET | `/api/integrations/google-calendar/events` | Listar eventos | admin, superadmin |

### Contexto Conversacional

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| GET | `/api/leads/:id/ai-context` | Obtener historial | todos |
| DELETE | `/api/leads/:id/ai-context` | Limpiar historial | admin, superadmin |

---

## 💬 Uso del Agente IA por WhatsApp

Una vez configurado, los usuarios pueden interactuar naturalmente:

### Ejemplos de Conversaciones

**1. Consulta de Información**
```
Usuario: Hola, qué servicios ofrecen?
Agente: ¡Hola! Ofrecemos Servicio 1 y Servicio 2.
        Nuestro horario es de 9am a 6pm de lunes a viernes.
        ¿En qué te puedo ayudar específicamente?
```

**2. Agendar Cita**
```
Usuario: Quiero agendar una cita para mañana a las 2pm
Agente: [Ejecuta create_calendar_event tool]
        ✅ Perfecto, agendé tu cita para mañana 8 de febrero a las 2pm.
        Te envié el link del calendario con Google Meet incluido.
```

**3. Contexto Conversacional**
```
Usuario: Cuánto cuesta?
Agente: El precio del Servicio 1 es...

Usuario: Y incluye instalación?
Agente: [Recuerda que hablamos de Servicio 1]
        Sí, el Servicio 1 incluye instalación gratuita.
```

---

## 🛠️ Sistema de Tools

### Tools Disponibles

#### 1. EchoTool (Testing)
Tool de prueba que repite el texto recibido.

```json
{
  "name": "echo",
  "description": "Herramienta de prueba que devuelve el mismo texto",
  "parameters": {
    "text": "string (requerido)",
    "repeat": "number (opcional)"
  }
}
```

#### 2. CalendarTool (Google Calendar)
Agenda citas en Google Calendar con Google Meet.

```json
{
  "name": "create_calendar_event",
  "description": "Agenda una cita o reunión en Google Calendar",
  "parameters": {
    "title": "string (requerido)",
    "description": "string (opcional)",
    "startDateTime": "string ISO 8601 (requerido)",
    "endDateTime": "string ISO 8601 (requerido)",
    "guestEmail": "string (opcional)",
    "timeZone": "string (opcional)",
    "includeMeet": "boolean (opcional, default: true)"
  }
}
```

### Crear un Nuevo Tool

Ver documentación completa en: [TOOLS_SYSTEM.md](./TOOLS_SYSTEM.md)

---

## 📊 Rate Limiting

Control de costos automático por tenant:

| Límite | Default | Configurable |
|--------|---------|--------------|
| Mensajes por lead por día | 50 | ✅ |
| Tool calls por día | 100 | ✅ |
| Tokens por día | 1,000,000 | ✅ |

**Ver estadísticas:**
```bash
curl http://localhost:3001/api/ai-agent/stats?date=2024-02-07 \
  -H "Authorization: Bearer <token>"
```

**Respuesta:**
```json
{
  "success": true,
  "stats": {
    "date": "2024-02-07",
    "messagesProcessed": 45,
    "toolCallsExecuted": 8,
    "tokensUsed": 12350,
    "estimatedCost": 0.25
  }
}
```

---

## 🔒 Seguridad

### Encriptación de Tokens OAuth

- **Algoritmo:** AES-256-GCM
- **Derivación de clave:** PBKDF2 (100,000 iteraciones)
- **Clave única por tenant**
- **Auth tag para integridad**

### Multi-Tenant Isolation

- Credenciales bajo `tenants/{tenantId}/config/integrations`
- Validación de `tenantId` en cada operación
- OAuth state parameter incluye tenant
- Rate limiting independiente

### Manejo de Errores

- Fallback a secuencias estáticas si falla IA
- Refresh automático de tokens OAuth
- Retry logic en tool execution
- Logging completo de errores

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                  Mensaje WhatsApp                    │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│            whatsappService.js (línea 668)           │
│         ¿Tenant tiene agente IA habilitado?         │
└─────┬───────────────────────────────────┬───────────┘
      │ SÍ                               │ NO
      │                                   │
┌─────▼──────────────────┐    ┌──────────▼──────────┐
│  aiAgentService.js     │    │  Flujo de Secuencias│
│  ┌──────────────────┐  │    │  (actual, estático) │
│  │ OpenAI GPT-4o    │  │    └─────────────────────┘
│  │ + Tool Calling   │  │
│  └────────┬─────────┘  │
│           │            │
│  ┌────────▼─────────┐  │
│  │ ToolExecutor     │  │
│  │ - CalendarTool   │  │
│  │ - EchoTool       │  │
│  └────────┬─────────┘  │
│           │            │
│  ┌────────▼─────────┐  │
│  │ Google Calendar  │  │
│  │ API (OAuth 2.0)  │  │
│  └──────────────────┘  │
└────────────────────────┘
```

### Flujo de Tool Execution

```
1. Usuario: "Quiero agendar una cita mañana a las 2pm"
   ↓
2. OpenAI detecta intención → tool_call: create_calendar_event
   ↓
3. ToolExecutor valida parámetros y rate limits
   ↓
4. CalendarTool obtiene access token válido (refresca si expiró)
   ↓
5. CalendarClient crea evento en Google Calendar
   ↓
6. Resultado → OpenAI genera respuesta final
   ↓
7. Agente: "✅ Cita agendada para mañana 8 de febrero a las 2pm"
```

---

## 📈 Costos Estimados

### OpenAI GPT-4o

- **Input:** $5 / 1M tokens
- **Output:** $15 / 1M tokens
- **Promedio:** ~500 tokens por mensaje
- **Costo por mensaje:** ~$0.005

**Para 1000 mensajes/día:**
- Costo diario: ~$5 USD
- Costo mensual: ~$150 USD

### Google Calendar API

- **Gratis** hasta 1M requests/día
- Más que suficiente para uso normal

---

## 🧪 Testing

### Test Manual Completo

```bash
# 1. Habilitar agente
curl -X PATCH .../ai-agent/config -d '{"enabled": true, "enabledTools": ["create_calendar_event"]}'

# 2. Conectar Google Calendar
curl .../google-calendar/auth-url
# Abrir URL, autorizar, copiar code
curl -X POST .../google-calendar/callback -d '{"code": "...", "state": "default"}'

# 3. Verificar conexión
curl .../google-calendar/status

# 4. Probar agendar cita
curl -X POST .../ai-agent/test -d '{"message": "Quiero agendar una cita mañana a las 2pm"}'

# 5. Verificar evento en Calendar
curl .../google-calendar/events

# 6. Ver estadísticas
curl .../ai-agent/stats
```

---

## 📖 Documentación Adicional

- [TOOLS_SYSTEM.md](./TOOLS_SYSTEM.md) - Sistema de tools completo
- [GOOGLE_CALENDAR_SETUP.md](./GOOGLE_CALENDAR_SETUP.md) - Setup de Google Calendar

---

## 🎁 Próximas Mejoras

- [ ] Frontend para configuración visual
- [ ] Más tools: Stripe, SendGrid, Airtable
- [ ] Voice mode (transcripción de audios)
- [ ] Analytics dashboard
- [ ] Multi-provider (Claude, Gemini)
- [ ] Streaming responses

---

## 🐛 Troubleshooting

Ver secciones de troubleshooting en:
- [GOOGLE_CALENDAR_SETUP.md](./GOOGLE_CALENDAR_SETUP.md#troubleshooting)
- [TOOLS_SYSTEM.md](./TOOLS_SYSTEM.md#troubleshooting)

---

## 📞 Soporte

Para problemas o preguntas, revisar:
1. Esta documentación
2. Logs del servidor (`console.log` con prefijos `[AI]`, `[OAuth]`, `[ToolExecutor]`)
3. Estado de conexiones con endpoints `/status`
