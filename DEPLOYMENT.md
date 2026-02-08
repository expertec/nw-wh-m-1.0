# Deployment a Render.com

## Problema: Sesiones de WhatsApp en Render

En Render, los archivos locales **no persisten** entre deployments. Cada vez que haces deploy, el contenedor se reinicia y pierdes todas las sesiones de WhatsApp guardadas en `/var/data/`.

## Soluciones

### Opción 1: Usar Render Disk (Recomendado)

Render ofrece discos persistentes que sobreviven deployments.

#### Pasos:

1. **En el Dashboard de Render:**
   - Ve a tu servicio → Settings
   - Sección "Disks"
   - Click "Add Disk"
   - **Name**: `whatsapp-sessions`
   - **Mount Path**: `/var/data`
   - **Size**: 1 GB (suficiente para sesiones)
   - Save

2. **Variables de entorno:**
   ```
   NODE_ENV=production
   PORT=3001
   AUTH_DATA_PATH=/var/data
   ```

3. **Secret Files:**
   - Path: `/etc/secrets/serviceAccountKey.json`
   - Content: (pega tu serviceAccountKey.json completo)

#### Ventajas:
- ✅ Sesiones persisten entre deployments
- ✅ No se pierde la conexión de WhatsApp
- ✅ Cada tenant tiene su propia sesión

#### Desventajas:
- ❌ Costo adicional (~$0.25/GB/mes)
- ❌ Solo un servidor puede acceder al disco a la vez

---

### Opción 2: Firebase Storage (Multi-instancia)

Guardar las sesiones en Firebase Storage permite múltiples instancias del servidor.

#### Implementación:

**1. Crear función para guardar/cargar sesiones desde Firebase Storage:**

```javascript
// server/sessionStorage.js
import { admin } from './firebaseAdmin.js';
import fs from 'fs';
import path from 'path';

const bucket = admin.storage().bucket();

export async function downloadSession(tenantId, localPath) {
  try {
    const remotePath = `sessions/${tenantId}/`;
    const [files] = await bucket.getFiles({ prefix: remotePath });

    if (!fs.existsSync(localPath)) {
      fs.mkdirSync(localPath, { recursive: true });
    }

    for (const file of files) {
      const filename = file.name.split('/').pop();
      if (filename) {
        await file.download({ destination: path.join(localPath, filename) });
      }
    }

    console.log(`📥 Sesión descargada desde Storage: ${tenantId}`);
  } catch (err) {
    console.log(`No hay sesión previa en Storage para: ${tenantId}`);
  }
}

export async function uploadSession(tenantId, localPath) {
  try {
    if (!fs.existsSync(localPath)) return;

    const files = fs.readdirSync(localPath);
    const remotePath = `sessions/${tenantId}/`;

    for (const file of files) {
      const localFile = path.join(localPath, file);
      await bucket.upload(localFile, {
        destination: `${remotePath}${file}`,
      });
    }

    console.log(`📤 Sesión subida a Storage: ${tenantId}`);
  } catch (err) {
    console.error(`Error subiendo sesión para ${tenantId}:`, err);
  }
}
```

**2. Modificar whatsappService.js para usar Storage:**

```javascript
import { downloadSession, uploadSession } from './sessionStorage.js';

export async function connectToWhatsApp(tenantId = DEFAULT_TENANT_ID) {
  const tId = requireTenantId(tenantId);
  const session = ensureSession(tId);
  const localAuthFolder = path.join(localAuthBase, tId);

  // Descargar sesión desde Storage si existe
  await downloadSession(tId, localAuthFolder);

  // ... resto del código de conexión ...

  // Guardar cambios de credenciales
  sock.ev.on('creds.update', async () => {
    await saveCreds();
    // Subir a Storage después de guardar
    await uploadSession(tId, localAuthFolder);
  });

  // ... resto del código ...
}
```

#### Ventajas:
- ✅ Sesiones persisten sin disco adicional
- ✅ Múltiples instancias pueden usar la misma sesión
- ✅ Sin costo adicional (Storage gratis hasta 5GB)
- ✅ Backup automático en la nube

#### Desventajas:
- ❌ Requiere modificar código
- ❌ Latencia en cargar/guardar sesiones

---

### Opción 3: Base de datos (MongoDB/PostgreSQL)

Similar a Firebase Storage pero usando base de datos.

#### Ventajas:
- ✅ Control total de las sesiones
- ✅ Queries rápidas

#### Desventajas:
- ❌ Más complejo de implementar
- ❌ Requiere base de datos adicional

---

## Recomendación por Escenario

### Para 1-5 tenants (uso pequeño):
**→ Render Disk** ($0.25/GB/mes)
- Simple
- No requiere cambios de código
- Suficiente para pocos tenants

### Para 5+ tenants (escala media):
**→ Firebase Storage**
- Sin costo adicional hasta 5GB
- Mejor para escalar
- Sesiones en la nube

### Para empresas (escala alta):
**→ Base de datos dedicada**
- Control total
- Performance óptima
- Más costoso

---

## Configuración Actual (Desarrollo)

```javascript
// whatsappService.js - línea 45
const localAuthBase = process.env.AUTH_DATA_PATH ||
  (process.env.NODE_ENV === 'production' ? '/var/data' : './auth_info');
```

En **desarrollo**: `./auth_info/{tenantId}/`
En **producción** (Render): `/var/data/{tenantId}/`

---

## Pasos para Deploy en Render

### 1. Configurar servicio

```yaml
# render.yaml
services:
  - type: web
    name: whatsapp-crm
    env: node
    plan: starter
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
    disk:
      name: whatsapp-sessions
      mountPath: /var/data
      sizeGB: 1
```

### 2. Variables de entorno en Render

```
NODE_ENV=production
PORT=3001
```

### 3. Secret Files

Path: `/etc/secrets/serviceAccountKey.json`
Content: (contenido completo de tu serviceAccountKey.json)

### 4. Deploy

```bash
git push origin main
```

Render detectará los cambios y hará deploy automáticamente.

---

## Verificar que funciona

1. **Logs del servidor:**
   ```
   📋 Usando credenciales de producción
   WhatsApp CRM Server escuchando en puerto 3001
   ```

2. **Conectar WhatsApp:**
   - Frontend → Settings → Conectar WhatsApp
   - Escanear QR
   - Verificar que se conecta

3. **Hacer deploy nuevamente:**
   - Push cambios
   - Verificar que la sesión persiste
   - No debería pedir escanear QR nuevamente

---

## Troubleshooting

### Error: "ENOENT: no such file or directory /var/data"
**Solución**: Verificar que el disco esté montado en `/var/data`

### Sesión se pierde después de deploy
**Solución**: Verificar que el disco esté configurado correctamente

### Multiple instances causing logout
**Solución**: Usar Firebase Storage en lugar de disco local

---

¿Necesitas ayuda implementando alguna de estas opciones?
