# Setup del Servidor - WhatsApp CRM

## 1. Obtener credenciales de Firebase

### Paso 1: Ir a Firebase Console
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto (`nw-crm-wh`)

### Paso 2: Descargar Service Account Key
1. Ve a **Project Settings** (⚙️ en la barra lateral)
2. Pestaña **Service accounts**
3. Click en **Generate new private key**
4. Confirma y descarga el archivo JSON

### Paso 3: Colocar el archivo
Guarda el archivo descargado como:
```
/Users/macbookprom1/Desktop/Proyect/server/serviceAccountKey.json
```

**⚠️ IMPORTANTE**: Este archivo contiene credenciales sensibles. NO lo subas a git.

## 2. Agregar al .gitignore

Crea o edita `/Users/macbookprom1/Desktop/Proyect/server/.gitignore`:
```
serviceAccountKey.json
node_modules/
uploads/
.env
```

## 3. Instalar dependencias

```bash
cd /Users/macbookprom1/Desktop/Proyect/server
npm install
```

## 4. Iniciar el servidor

```bash
npm start
```

Deberías ver:
```
📋 Usando credenciales locales (server/)
WhatsApp CRM Server escuchando en puerto 3001
```

## 5. Configurar WhatsApp Multi-Tenant (Opcional)

El sistema soporta múltiples conexiones de WhatsApp (una por tenant).

### Carpeta de autenticación
Las sesiones se guardan en:
- **Desarrollo**: `./auth_info/{tenantId}/`
- **Producción**: `/var/data/{tenantId}/`

La carpeta se crea automáticamente al conectar WhatsApp.

### Variables de entorno (opcional)
Copia `.env.example` a `.env` y ajusta según necesites:

```bash
cp .env.example .env
```

Ejemplo de `.env`:
```
PORT=3001
NODE_ENV=development
AUTH_DATA_PATH=./auth_info
```

## 6. Verificar que funciona

### Opción A: Desde el frontend
1. Inicia sesión como superadmin
2. Ve a la página de Tenants
3. Crea un nuevo tenant con email
4. Verifica que aparezca el diálogo con las credenciales
5. Cierra sesión e intenta iniciar sesión con esas credenciales

### Opción B: Desde la API directamente
```bash
# Asumiendo que tienes un token de superadmin
curl -X POST http://localhost:3001/api/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "id": "test-tenant",
    "nombre": "Tenant de Prueba",
    "plan": "basico",
    "ownerEmail": "test@example.com"
  }'
```

## Troubleshooting

### Error: "No se encontraron credenciales de Firebase"
- Verifica que `serviceAccountKey.json` esté en `server/`
- Verifica que el archivo sea JSON válido
- Verifica los permisos del archivo

### Error: "Permission denied" en Firebase
- El Service Account debe tener rol **Firebase Admin SDK Administrator Service Agent**
- Verifica en Firebase Console → IAM & Admin

### Los usuarios no se crean en Firebase Auth
- Revisa los logs del servidor para errores específicos
- Verifica que Firebase Authentication esté habilitado en Firebase Console
- Verifica que el método Email/Password esté habilitado en Authentication → Sign-in method

## Ubicaciones de credenciales (prioridad)

El servidor busca credenciales en este orden:

1. **Producción (Render)**: `/etc/secrets/serviceAccountKey.json`
2. **Local (server/)**: `./serviceAccountKey.json`
3. **Local (raíz)**: `../serviceAccountKey.json`
4. **Variable de entorno**: `FIREBASE_SERVICE_ACCOUNT`

## Producción (Render)

Para deploy en Render:
1. Ve a tu servicio en Render
2. Settings → Secret Files
3. Sube `serviceAccountKey.json` con path `/etc/secrets/serviceAccountKey.json`
