# 🌐 Webhook para Formularios Web → CRM

Este endpoint permite capturar leads desde formularios web de cada negocio y guardarlos automáticamente en el CRM con activación de secuencias.

---

## 🎯 URL del Webhook

```
POST https://nw-wh-m-1-0.onrender.com/api/webhook/lead
```

---

## 🔐 Autenticación

Hay **dos formas** de autenticar:

### Opción 1: Solo `tenantId` (Simple, menos seguro)
```json
{
  "tenantId": "axios",
  "nombre": "Juan Pérez",
  "telefono": "+52 33 1234 5678"
}
```

### Opción 2: `tenantId` + `apiKey` (Recomendado, más seguro)
```json
{
  "tenantId": "axios",
  "apiKey": "tu-api-key-secreta",
  "nombre": "Juan Pérez",
  "telefono": "+52 33 1234 5678"
}
```

---

## 📝 Campos del Formulario

### Campos Requeridos
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | string | Nombre completo del lead |
| `telefono` | string | Teléfono con código de país (ej: +52 33 1234 5678) |

### Campos Opcionales (predefinidos)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `email` | string | Email del lead |
| `ciudad` | string | Ciudad del proyecto |
| `metrosCuadrados` | string/number | Metros cuadrados del proyecto |
| `mensaje` | string | Mensaje adicional del lead |

### Campos Personalizados
Cualquier otro campo que envíes se guardará automáticamente en `customFields`:
```json
{
  "nombre": "Juan",
  "telefono": "+52 33 1234 5678",
  "presupuesto": "500000",
  "tipoServicio": "Impermeabilización",
  "urgencia": "Alta"
}
```
Los campos `presupuesto`, `tipoServicio`, `urgencia` se guardarán en `customFields`.

---

## ✅ Respuesta Exitosa

### Lead Nuevo (201 Created)
```json
{
  "success": true,
  "message": "Lead creado y secuencia activada",
  "leadId": "WA_523312345678",
  "trigger": "NuevoLeadWeb"
}
```

### Lead Existente (200 OK)
```json
{
  "success": true,
  "message": "Lead actualizado",
  "leadId": "WA_523312345678"
}
```

---

## ❌ Respuestas de Error

### 400 - Campos faltantes
```json
{
  "error": "Campos requeridos: nombre, telefono",
  "received": { "nombre": true, "telefono": false }
}
```

### 403 - API Key inválida
```json
{
  "error": "API Key inválida"
}
```

### 404 - Tenant no encontrado
```json
{
  "error": "Tenant no encontrado"
}
```

### 500 - Error del servidor
```json
{
  "error": "Error interno del servidor",
  "details": "Descripción del error"
}
```

---

## 🔧 Configurar API Key (Opcional pero Recomendado)

Para mayor seguridad, configura una API Key única por tenant:

### 1. Desde Firestore Console
```
Colección: tenants/{tenantId}/config/appConfig
Campo: webhookApiKey = "tu-api-key-secreta-123"
```

### 2. Desde el CRM (próximamente)
```
Settings → Webhook → Generar API Key
```

---

## 💻 Ejemplos de Código

### HTML + JavaScript (Vanilla)
```html
<form id="contactForm">
  <input type="text" name="nombre" placeholder="Nombre completo" required>
  <input type="tel" name="telefono" placeholder="+52 33 1234 5678" required>
  <input type="email" name="email" placeholder="Email">
  <input type="text" name="ciudad" placeholder="Ciudad">
  <input type="number" name="metrosCuadrados" placeholder="Metros cuadrados">
  <textarea name="mensaje" placeholder="Mensaje"></textarea>
  <button type="submit">Enviar</button>
</form>

<script>
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);

  try {
    const response = await fetch('https://nw-wh-m-1-0.onrender.com/api/webhook/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'axios',  // Cambiar por tu tenantId
        apiKey: 'tu-api-key-secreta',  // Opcional
        ...data
      })
    });

    const result = await response.json();

    if (result.success) {
      alert('¡Gracias! Nos pondremos en contacto pronto.');
      e.target.reset();
    } else {
      alert('Error: ' + result.error);
    }
  } catch (error) {
    alert('Error al enviar el formulario');
  }
});
</script>
```

---

### React + Axios
```jsx
import { useState } from 'react';
import axios from 'axios';

function ContactForm() {
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    ciudad: '',
    metrosCuadrados: '',
    mensaje: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post('https://nw-wh-m-1-0.onrender.com/api/webhook/lead', {
        tenantId: 'axios',  // Cambiar por tu tenantId
        apiKey: 'tu-api-key-secreta',  // Opcional
        ...formData
      });

      if (response.data.success) {
        alert('¡Gracias! Nos pondremos en contacto pronto.');
        setFormData({ nombre: '', telefono: '', email: '', ciudad: '', metrosCuadrados: '', mensaje: '' });
      }
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Error al enviar'));
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Nombre completo"
        value={formData.nombre}
        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
        required
      />
      <input
        type="tel"
        placeholder="+52 33 1234 5678"
        value={formData.telefono}
        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <input
        type="text"
        placeholder="Ciudad"
        value={formData.ciudad}
        onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
      />
      <input
        type="number"
        placeholder="Metros cuadrados"
        value={formData.metrosCuadrados}
        onChange={(e) => setFormData({ ...formData, metrosCuadrados: e.target.value })}
      />
      <textarea
        placeholder="Mensaje"
        value={formData.mensaje}
        onChange={(e) => setFormData({ ...formData, mensaje: e.target.value })}
      />
      <button type="submit">Enviar</button>
    </form>
  );
}
```

---

### WordPress (functions.php o plugin)
```php
<?php
// Manejar el formulario de contacto
add_action('wp_ajax_nopriv_submit_lead', 'handle_lead_submission');
add_action('wp_ajax_submit_lead', 'handle_lead_submission');

function handle_lead_submission() {
    $data = array(
        'tenantId' => 'axios',  // Cambiar por tu tenantId
        'apiKey' => 'tu-api-key-secreta',  // Opcional
        'nombre' => sanitize_text_field($_POST['nombre']),
        'telefono' => sanitize_text_field($_POST['telefono']),
        'email' => sanitize_email($_POST['email']),
        'ciudad' => sanitize_text_field($_POST['ciudad']),
        'metrosCuadrados' => sanitize_text_field($_POST['metrosCuadrados']),
        'mensaje' => sanitize_textarea_field($_POST['mensaje'])
    );

    $response = wp_remote_post('https://nw-wh-m-1-0.onrender.com/api/webhook/lead', array(
        'method' => 'POST',
        'headers' => array('Content-Type' => 'application/json'),
        'body' => json_encode($data)
    ));

    if (is_wp_error($response)) {
        wp_send_json_error(array('message' => 'Error al enviar'));
    } else {
        $body = json_decode(wp_remote_retrieve_body($response), true);
        wp_send_json_success($body);
    }
}
?>
```

---

## 🎯 Flujo Completo

```
1. Usuario llena formulario en sitio web del negocio
                    ↓
2. Formulario envía POST /api/webhook/lead
                    ↓
3. Backend valida tenantId/apiKey
                    ↓
4. Se crea/actualiza lead en Firestore
   → tenants/{tenantId}/leads/WA_{telefono}
                    ↓
5. Se activa secuencia automática (trigger: defaultTrigger)
                    ↓
6. Lead recibe primer mensaje de WhatsApp
                    ↓
7. Respuestas del lead se guardan en el CRM
```

---

## 🔍 Verificar en el CRM

Después de enviar un formulario:

1. **Login al CRM** con las credenciales del tenant
2. **Ir a Leads** → Deberías ver el nuevo lead con:
   - Nombre
   - Teléfono
   - Etiqueta: "Web"
   - Estado: "nuevo"
   - Secuencia activa
3. **Ir a Chat** → Ver conversación con el lead

---

## 🛡️ Seguridad

### Recomendaciones:

1. **Usa API Key** en producción (no solo tenantId)
2. **Valida en el frontend** antes de enviar
3. **Sanitiza inputs** para evitar XSS
4. **Rate limiting** (próximamente) para evitar spam
5. **No expongas el tenantId** en código fuente público si no usas apiKey
6. **Usa HTTPS** siempre

### Generar API Key Segura:
```javascript
// En Node.js
const crypto = require('crypto');
const apiKey = crypto.randomBytes(32).toString('hex');
console.log(apiKey); // Guardar en Firestore: webhookApiKey
```

---

## 📊 Datos que se Guardan en Firestore

### Estructura del Lead
```javascript
{
  // IDs
  id: "WA_523312345678",
  jid: "523312345678@s.whatsapp.net",

  // Datos básicos
  nombre: "Juan Pérez",
  telefono: "523312345678",
  email: "juan@example.com",
  ciudad: "Guadalajara",
  metrosCuadrados: "200",
  mensaje: "Quiero impermeabilizar mi casa",

  // Campos personalizados (si se enviaron)
  customFields: {
    presupuesto: "500000",
    tipoServicio: "Impermeabilización"
  },

  // Metadata
  source: "Formulario Web",
  fecha_creacion: Timestamp,
  lastMessageAt: Timestamp,
  estado: "nuevo",
  etiquetas: ["Web", "NuevoLeadWeb"],

  // Secuencias
  hasActiveSequences: true,
  seqPaused: false,
  secuenciasActivas: [
    {
      trigger: "NuevoLeadWeb",
      startedAt: Timestamp
    }
  ],

  // Mensajes
  unreadCount: 0
}
```

---

## 🧪 Probar el Webhook

### Con cURL:
```bash
curl -X POST https://nw-wh-m-1-0.onrender.com/api/webhook/lead \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "axios",
    "nombre": "Test Lead",
    "telefono": "+52 33 1234 5678",
    "email": "test@example.com",
    "ciudad": "Guadalajara"
  }'
```

### Con Postman:
1. Method: `POST`
2. URL: `https://nw-wh-m-1-0.onrender.com/api/webhook/lead`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "tenantId": "axios",
  "nombre": "Test Lead",
  "telefono": "+52 33 1234 5678",
  "email": "test@example.com"
}
```

---

## ❓ FAQ

**¿El teléfono debe tener formato específico?**
No, el sistema normaliza automáticamente. Acepta:
- `+52 33 1234 5678`
- `33 1234 5678`
- `3312345678`
- `52 33 1234 5678`

**¿Qué pasa si el lead ya existe?**
Se actualizan sus datos y NO se activa una nueva secuencia (para evitar spam).

**¿Cuánto tarda en recibir el mensaje?**
El lead recibe el primer mensaje de la secuencia en menos de 1 minuto (según el delay configurado).

**¿Puedo usar esto con Zapier/Make.com?**
Sí, configura un webhook con método POST y los campos JSON.

**¿Funciona con formularios de Google Forms?**
Sí, usa Google Apps Script para enviar los datos al webhook.

---

## 🚀 Próximas Mejoras

- [ ] Panel en Settings para generar/ver API Key
- [ ] Rate limiting por tenant
- [ ] Webhooks personalizados por trigger
- [ ] Notificaciones Slack/Discord al recibir lead
- [ ] Analytics de conversión por formulario
- [ ] CAPTCHA integrado

---

¿Preguntas? Contacta al equipo de desarrollo.
