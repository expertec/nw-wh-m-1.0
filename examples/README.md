# 📋 Ejemplos de Integración de Formularios Web

Este directorio contiene ejemplos de cómo integrar formularios web con el CRM.

---

## 🚀 Inicio Rápido

### 1. Usar el formulario HTML de ejemplo

1. Abre `formulario-ejemplo.html` en un editor
2. Busca la sección `CONFIG` (línea ~180)
3. Cambia `tenantId: 'axios'` por tu tenant
4. (Opcional) Agrega tu `apiKey` para mayor seguridad
5. Sube el archivo a tu sitio web
6. ¡Listo! Los leads se guardarán automáticamente en tu CRM

### 2. Ver la documentación completa

Lee `../WEBHOOK_FORMS.md` para:
- Detalles de la API
- Ejemplos en React, WordPress, PHP
- Configuración de API Key
- Troubleshooting

---

## 📁 Archivos

| Archivo | Descripción |
|---------|-------------|
| `formulario-ejemplo.html` | Formulario completo listo para usar |
| `../WEBHOOK_FORMS.md` | Documentación completa del webhook |

---

## 🎯 Lo que hace el formulario

1. Usuario llena el formulario
2. Se valida en el frontend
3. Se envía a `/api/webhook/lead`
4. Se crea el lead en el CRM
5. Se activa secuencia automática
6. Lead recibe WhatsApp en menos de 1 minuto

---

## 🔐 Configurar API Key (Recomendado)

```javascript
// 1. Generar API Key
const crypto = require('crypto');
const apiKey = crypto.randomBytes(32).toString('hex');
console.log(apiKey);

// 2. Guardar en Firestore
// tenants/{tuTenantId}/config/appConfig
// Campo: webhookApiKey = "el-api-key-generado"

// 3. Usar en el formulario
const CONFIG = {
  tenantId: 'tu-tenant',
  apiKey: 'el-api-key-generado'
};
```

---

## ✅ Probar

1. Abre `formulario-ejemplo.html` en el navegador
2. Llena los campos
3. Envía
4. Revisa el CRM → Leads
5. Verifica que aparezca el nuevo lead

---

## 💡 Tips

- Personaliza los estilos del formulario
- Agrega campos personalizados (se guardan en `customFields`)
- Conecta con Google Analytics para tracking
- Usa CAPTCHA para evitar spam
- Prueba primero con tu teléfono

---

## 🆘 Problemas Comunes

**Error 400 - Campos faltantes**
→ Verifica que `nombre` y `telefono` estén presentes

**Error 403 - API Key inválida**
→ Verifica que el apiKey coincida con Firestore

**Error 404 - Tenant no encontrado**
→ Verifica que el tenantId sea correcto

**No recibo el WhatsApp**
→ Verifica que:
- El tenant tenga WhatsApp conectado
- Exista una secuencia con el trigger configurado
- El número esté correcto (con código de país)

---

¿Preguntas? Lee la documentación completa en `WEBHOOK_FORMS.md`
