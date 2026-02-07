# WhatsApp CRM - Frontend

Frontend del CRM de WhatsApp construido con Next.js 14, shadcn/ui, Tailwind CSS y Firebase.

## Stack Tecnológico

- **Framework:** Next.js 14 (App Router)
- **UI:** shadcn/ui + Tailwind CSS
- **Auth:** Firebase Authentication
- **Database:** Firebase Firestore (real-time)
- **API Client:** Axios
- **Lenguaje:** TypeScript

## Setup Inicial

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Firebase

Edita `.env.local` con tus credenciales de Firebase (obtenerlas de Firebase Console → Project Settings):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=tu-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=nw-crm-wh.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nw-crm-wh
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=nw-crm-wh.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=tu-app-id

NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

El frontend estará disponible en `http://localhost:3000`

## Características

### Dashboard
- Métricas en tiempo real: total leads, nuevos hoy, con secuencia activa, sin leer
- Badge de estado de conexión WhatsApp

### Leads
- Lista con búsqueda en tiempo real
- Ver: nombre, teléfono, estado, etiquetas, mensajes sin leer
- Pausar/reanudar secuencias por lead

### Chat WhatsApp
- Vista split: lista de leads + conversación
- Mensajes en tiempo real (onSnapshot)
- Soporte multimedia: texto, imágenes, videos, audios, documentos
- Auto-scroll y marca como leído automático

### Secuencias
- Lista de secuencias activas/inactivas
- Editor con pasos configurables
- Tipos: texto, imagen, audio, video, videonota, formulario
- Placeholders: `{{nombre}}`, `{{telefono}}`

### Settings
- **WhatsApp:** Ver estado, conectar, QR code, número
- **Config:** defaultTrigger, defaultTriggerMetaAds
- **Hashtags:** Mapeo de hashtags a triggers

### Tenants (superadmin)
- CRUD de tenants
- Habilitar/deshabilitar
- Configurar plan y owner

## Roles

- **agent:** Dashboard, leads, chat
- **admin:** + secuencias, config, WhatsApp
- **superadmin:** + tenants, acceso cross-tenant

## Scripts

```bash
npm run dev          # Desarrollo
npm run build        # Build producción
npm run start        # Servidor producción
npm run lint         # Linter
```

## Estructura

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Rutas protegidas
│   └── login/              # Login público
├── components/             # Componentes UI
├── hooks/                  # Hooks custom (Firestore)
├── lib/                    # Utils (Firebase, API, auth)
└── types/                  # Tipos TypeScript
```

## Configuración Firebase Security Rules

Ver documentación completa en el archivo para configurar Firestore rules correctamente con aislamiento multi-tenant.
