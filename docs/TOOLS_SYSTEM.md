# Sistema de Tools para Agente IA

## Introducción

El sistema de tools permite que el agente IA ejecute acciones concretas, como agendar citas, enviar correos, consultar APIs externas, etc.

## Arquitectura

```
Mensaje del usuario → Agente IA → ¿Necesita ejecutar acción?
                                           ↓
                                    ToolRegistry → ToolExecutor
                                           ↓
                                    Ejecutar Tool (ej: CalendarTool)
                                           ↓
                                    Resultado → De vuelta al Agente
                                           ↓
                                    Respuesta final al usuario
```

## Componentes

### 1. ToolInterface (Base Class)

Clase abstracta que todos los tools deben heredar.

**Métodos obligatorios:**
- `execute({ tenantId, leadId, parameters })` - Ejecuta el tool
- `getToolDefinition()` - Retorna definición para OpenAI

**Métodos opcionales:**
- `verifyIntegration(tenantId)` - Verifica si el tenant tiene la integración configurada
- `validateParameters(parameters)` - Valida parámetros recibidos

### 2. ToolRegistry

Registro centralizado de todos los tools disponibles.

**Métodos principales:**
- `register(toolInstance)` - Registra un tool
- `getTool(toolName)` - Obtiene un tool por nombre
- `getEnabledTools(tenantId)` - Obtiene tools habilitados para un tenant
- `getAllDefinitions()` - Retorna definiciones de todos los tools

### 3. ToolExecutor

Ejecutor de tools con manejo de errores y rate limiting.

**Métodos:**
- `executeAll({ tenantId, leadId, toolCalls })` - Ejecuta múltiples tools
- `executeSingle({ tenantId, leadId, toolCall })` - Ejecuta un solo tool

## Crear un Nuevo Tool

### Paso 1: Crear la clase

```javascript
// tools/mi-tool/MiTool.js
import { ToolInterface } from '../base/ToolInterface.js';

export class MiTool extends ToolInterface {
  async execute({ tenantId, leadId, parameters }) {
    // Tu lógica aquí
    const result = await tuFuncion(parameters);

    // Retornar resultado en formato estándar
    return {
      success: true,
      message: 'Operación completada',
      data: result
    };
  }

  async verifyIntegration(tenantId) {
    // Verificar si el tenant tiene esta integración configurada
    return true;
  }

  getToolDefinition() {
    return {
      name: 'mi_tool',
      description: 'Descripción clara de qué hace el tool',
      parameters: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: 'Descripción del parámetro'
          },
          param2: {
            type: 'number',
            description: 'Otro parámetro'
          }
        },
        required: ['param1']
      }
    };
  }
}

// Auto-registrar el tool
import { toolRegistry } from '../toolRegistry.js';
toolRegistry.register(new MiTool());
```

### Paso 2: Importar en aiAgentService.js

```javascript
// En ai/aiAgentService.js
import '../tools/mi-tool/MiTool.js'; // Auto-registro
```

### Paso 3: Habilitar para un tenant

```bash
curl -X PATCH http://localhost:3001/api/ai-agent/config \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "enabledTools": ["mi_tool", "echo"]
  }'
```

## Tool de Ejemplo: EchoTool

El EchoTool es un tool de prueba que repite el texto que recibe.

**Uso desde el agente:**

Usuario: "Ejecuta echo con el texto 'Hola mundo'"

El agente IA detecta que debe usar el tool `echo` y lo ejecuta:
```json
{
  "toolName": "echo",
  "parameters": {
    "text": "Hola mundo",
    "repeat": 1
  }
}
```

Resultado:
```json
{
  "success": true,
  "message": "Echo: Hola mundo",
  "data": {
    "originalText": "Hola mundo",
    "repeated": 1,
    "result": "Hola mundo"
  }
}
```

## Flujo Completo

1. **Usuario envía mensaje:** "Quiero agendar una cita mañana a las 2pm"

2. **Agente IA analiza:** GPT-4o detecta que necesita usar `create_calendar_event`

3. **OpenAI responde con tool call:**
   ```json
   {
     "toolCalls": [{
       "id": "call_abc123",
       "toolName": "create_calendar_event",
       "parameters": {
         "title": "Cita con cliente",
         "startDateTime": "2024-02-08T14:00:00",
         "endDateTime": "2024-02-08T15:00:00"
       }
     }]
   }
   ```

4. **ToolExecutor ejecuta el tool:**
   - Verifica rate limits
   - Valida parámetros
   - Verifica integración
   - Ejecuta `CalendarTool.execute()`

5. **Tool retorna resultado:**
   ```json
   {
     "success": true,
     "eventId": "evt_xyz789",
     "eventLink": "https://calendar.google.com/...",
     "message": "Cita agendada exitosamente"
   }
   ```

6. **Agente IA genera respuesta final:**
   "Perfecto, agendé tu cita para mañana 8 de febrero a las 2pm. Te envié el link del calendario."

## Rate Limiting

Los tools están sujetos a rate limiting por tenant:
- **Máximo de tool calls por día:** 100 (configurable)
- **Máximo de mensajes con IA por lead por día:** 50

## Logging

Cada ejecución de tool se registra en:
- `tenants/{tenantId}/leads/{leadId}/aiContext`
- Tipo: `tool_execution`
- Incluye: toolName, parameters, result, timestamp

## Testing

### Test Manual con API

```bash
# 1. Habilitar EchoTool
curl -X PATCH http://localhost:3001/api/ai-agent/config \
  -H "Authorization: Bearer <token>" \
  -d '{"enabledTools": ["echo"]}'

# 2. Enviar mensaje de prueba
curl -X POST http://localhost:3001/api/ai-agent/test \
  -H "Authorization: Bearer <token>" \
  -d '{"message": "Ejecuta echo con Hola mundo"}'
```

### Test Programático

```javascript
import { ToolExecutor } from './tools/base/ToolExecutor.js';

const result = await ToolExecutor.executeSingle({
  tenantId: 'default',
  leadId: 'test_123',
  toolCall: {
    id: 'test_call',
    toolName: 'echo',
    parameters: { text: 'test', repeat: 1 }
  }
});

console.log(result);
```

## Próximo Tool: Google Calendar

En la Fase 4 se implementará `CalendarTool` que permitirá:
- Agendar citas en Google Calendar
- Crear eventos con Google Meet automáticamente
- Sincronizar con el calendario del negocio
- Enviar invitaciones a clientes

## Mejores Prácticas

1. **Validación:** Siempre valida parámetros antes de ejecutar
2. **Manejo de errores:** Retorna mensajes claros para el usuario
3. **Idempotencia:** Tools deben poder ejecutarse múltiples veces sin efectos secundarios
4. **Timeouts:** Implementa timeouts para APIs externas
5. **Logging:** Registra todas las ejecuciones para debugging
6. **Seguridad:** No expongas credenciales en los resultados

## Troubleshooting

**Error: "Tool not found"**
- Verifica que el tool esté registrado en toolRegistry
- Asegúrate de importarlo en aiAgentService.js

**Error: "Integration not configured"**
- Verifica que el tenant tenga la integración configurada
- Implementa `verifyIntegration()` correctamente

**Error: "Rate limit exceeded"**
- Ajusta los límites en la configuración del tenant
- Verifica el uso en `/api/ai-agent/stats`
