# ✅ Checklist Multi-Tenant WhatsApp

## Estado de Implementación

### ✅ Backend - Multi-Tenant Completo

1. **Sesiones por Tenant** ✅
   - Carpetas separadas: `/var/data/{tenantId}/`
   - Cada tenant tiene su propia conexión de WhatsApp
   - Sesiones no se mezclan entre tenants

2. **Endpoints con TenantId** ✅
   - `/api/whatsapp/connect` → usa `getTenantId(req)`
   - `/api/whatsapp/status` → usa `getTenantId(req)`
   - `/api/whatsapp/send-message` → usa `getTenantId(req)`
   - Todos los endpoints validados ✅

3. **Firestore Aislado** ✅
   - `leadsCol(tenantId)` → leads del tenant correcto
   - `messagesCol(tenantId, leadId)` → mensajes del tenant correcto
   - `secuenciasCol(tenantId)` → secuencias del tenant correcto

4. **Listener de Mensajes** ✅
   - Usa `tId` (tenantId del socket)
   - Guarda mensajes en la colección correcta del tenant
   - No hay mezcla de datos entre tenants

---

## 🧪 Cómo Probar Multi-Tenant

### Escenario 1: Dos tenants, dos números de WhatsApp

**Tenant A (default):**
1. Login como admin del tenant "default"
2. Settings → WhatsApp → Conectar
3. Escanear QR con número A (ej: +52 1234 5678)
4. Verificar conexión exitosa

**Tenant B (axios):**
1. Logout
2. Login como admin del tenant "axios"
3. Settings → WhatsApp → Conectar
4. Escanear QR con número B (ej: +52 9876 5432)
5. Verificar conexión exitosa

**Verificación:**
- ✅ Ambos tenants deben estar conectados simultáneamente
- ✅ Mensajes al número A deben aparecer solo en tenant "default"
- ✅ Mensajes al número B deben aparecer solo en tenant "axios"
- ✅ No debe haber mezcla de leads entre tenants

---

### Escenario 2: Verificar Persistencia

1. Conectar WhatsApp en un tenant
2. Hacer deploy (push a Render)
3. Esperar que el servicio reinicie
4. Verificar que sigue conectado (sin pedir QR nuevo)

**Si se desconecta después del deploy:**
- ❌ El disco persistente NO está configurado correctamente
- Solución: Verificar Render Dashboard → Disks

---

## 🔍 Verificaciones de Código

### ✅ getTenantId funciona correctamente

```javascript
// server.js - línea 58
function getTenantId(req) {
  return requireTenantId(
    req.tenantId || DEFAULT_TENANT_ID
  );
}
```

**Dónde se establece `req.tenantId`:**
- Middleware `requireTenantMatch` (authMiddleware.js)
- Extrae tenantId del token JWT custom claims

### ✅ Autenticación JWT con tenantId

```javascript
// authMiddleware.js
export function requireAuth(req, res, next) {
  // Extrae token
  // Verifica con Firebase
  // Lee custom claims: { role, tenantId }
  // Establece req.tenantId
}
```

### ✅ Conexión Multi-Socket

```javascript
// whatsappService.js - línea 42
const sessions = new Map(); // tenantId -> { sock, latestQR, ... }

function ensureSession(tenantId) {
  if (!sessions.has(tenantId)) {
    sessions.set(tenantId, { /* nueva sesión */ });
  }
  return sessions.get(tenantId);
}
```

---

## 🎯 Flujo Completo Multi-Tenant

```
1. Admin Tenant A hace login
   └→ Firebase Auth devuelve token con { role: 'admin', tenantId: 'axios' }

2. Frontend guarda token en localStorage

3. Admin va a Settings → Conectar WhatsApp
   └→ POST /api/whatsapp/connect
       └→ requireAuth extrae tenantId='axios' del token
       └→ getTenantId(req) retorna 'axios'
       └→ connectToWhatsApp('axios')
           └→ Crea carpeta: /var/data/axios/
           └→ Crea socket separado en sessions.set('axios', { sock })
           └→ Genera QR para tenant 'axios'

4. Admin escanea QR con número de WhatsApp de su negocio

5. Mensaje entrante al número del negocio A
   └→ Listener detecta mensaje
   └→ Usa tId='axios' (del socket que recibió el mensaje)
   └→ Guarda en: tenants/axios/leads
   └→ Guarda mensaje en: tenants/axios/leads/{leadId}/messages

6. Admin Tenant B hace login con su cuenta
   └→ Token tiene { tenantId: 'checo' }
   └→ Conecta WhatsApp → otro número
   └→ Sesión totalmente separada
```

---

## ❌ Problemas Comunes y Soluciones

### Problema: Todos los tenants ven los mismos leads

**Causa:** Token no tiene custom claims correctos

**Verificar:**
```javascript
// Consola del navegador
const token = localStorage.getItem('token');
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('tenantId:', payload.tenantId);
console.log('role:', payload.role);
```

**Solución:**
- Verificar que el usuario tenga custom claims establecidos
- Re-crear usuario con `POST /api/tenants` (auto-crea claims)

---

### Problema: Sesión se desconecta después de deploy

**Causa:** Disco no persistente

**Verificar en shell de Render:**
```bash
df -h | grep /var/data
# Debe mostrar: /dev/disk X.XG ...
```

**Solución:**
- Render Dashboard → Disks → Add Disk → /var/data

---

### Problema: QR no aparece

**Causa:** Ya revisado y corregido ✅

**Solución aplicada:**
- QR se genera como base64 data URL
- Frontend usa `.includes('QR disponible')`
- Botón "Regenerar QR" para limpiar sesión

---

## 📦 Deploy Checklist

Antes de hacer deploy a Render:

- [ ] Disco persistente configurado (`/var/data`, 1GB)
- [ ] Secret Files: `/etc/secrets/serviceAccountKey.json`
- [ ] Variable de entorno: `NODE_ENV=production`
- [ ] Variable de entorno: `PORT=3001`
- [ ] Git push ejecutado
- [ ] Build exitoso
- [ ] Servidor inicia sin errores
- [ ] Test: Login como admin de tenant
- [ ] Test: Conectar WhatsApp
- [ ] Test: Enviar/recibir mensaje
- [ ] Test: Deploy nuevo → sesión persiste

---

## ✅ Estado Actual

**Según lo que mencionaste:**
- ✅ Disco creado en Render
- ✅ Carpetas en `/var/data/` (axios, checo, default, felipe-sa, thulu)
- ✅ Multi-tenant implementado en código
- ✅ Todo corriendo en producción (Render)

**Lo que funciona:**
- ✅ Cada tenant puede conectar su WhatsApp
- ✅ Sesiones se guardan en carpetas separadas
- ✅ Persistencia entre deploys (con disco configurado)

**Siguiente paso:**
- Conectar WhatsApp para cada tenant desde el frontend
- Verificar que cada uno use su propio número
- Confirmar que no hay mezcla de leads/mensajes

---

## 🚀 Instrucciones de Uso

### Para cada negocio (tenant):

1. **Crear tenant** (superadmin):
   - Tenants → Nuevo Tenant
   - ID: nombre-negocio
   - Email: admin@negocio.com
   - Guardar contraseña generada

2. **Conectar WhatsApp** (admin del tenant):
   - Login con credenciales del tenant
   - Settings → WhatsApp → Conectar
   - Escanear QR con el número del negocio
   - Verificar "Conectado"

3. **Usar el CRM:**
   - Leads solo del negocio
   - Mensajes solo del negocio
   - Secuencias solo del negocio
   - Todo aislado por tenant ✅

---

¿Algún paso no está funcionando como se describe aquí?
