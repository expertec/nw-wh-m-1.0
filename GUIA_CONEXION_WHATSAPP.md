# 📱 Guía: Conectar WhatsApp para cada Negocio

## Para Administradores de Tenant

Cada negocio tiene su propio panel y puede conectar su número de WhatsApp de forma independiente.

---

## 🎯 Pasos para Conectar WhatsApp

### 1️⃣ Acceder a tu Panel
```
1. Ve a: https://tu-app.onrender.com (o tu dominio)
2. Inicia sesión con las credenciales de tu negocio:
   - Email: admin@tunegocio.com
   - Contraseña: (la que te proporcionaron)
```

### 2️⃣ Ir a Configuración
```
1. En el menú lateral, haz click en "Configuración" ⚙️
2. Asegúrate de estar en la pestaña "WhatsApp"
```

### 3️⃣ Conectar WhatsApp
```
1. Verás el estado actual: "Desconectado" o "QR disponible"
2. Haz click en el botón "Conectar WhatsApp"
3. Espera 5-10 segundos (el servidor está generando tu QR único)
4. La página se actualizará automáticamente
```

### 4️⃣ Escanear el Código QR
```
1. Cuando aparezca el botón "Ver código QR", haz click en él
2. Se abrirá un diálogo con tu código QR único
3. Abre WhatsApp en tu teléfono:
   - Android: WhatsApp → ⋮ → Dispositivos vinculados → Vincular un dispositivo
   - iPhone: WhatsApp → Ajustes → Dispositivos vinculados → Vincular un dispositivo
4. Escanea el código QR que aparece en pantalla
5. ¡Listo! Tu WhatsApp está conectado
```

### 5️⃣ Verificar Conexión
```
1. El diálogo del QR se cerrará automáticamente
2. Verás el estado cambiar a "Conectado" 🟢
3. Aparecerá tu número de WhatsApp conectado
```

---

## ✅ Lo que Verás en tu Panel

### Antes de Conectar:
```
┌─────────────────────────────────────┐
│ Conexión WhatsApp                   │
├─────────────────────────────────────┤
│ 🔴 Estado: Desconectado             │
│ [Conectar WhatsApp]                 │
└─────────────────────────────────────┘
```

### Generando QR:
```
┌─────────────────────────────────────┐
│ Conexión WhatsApp                   │
├─────────────────────────────────────┤
│ 🟡 Estado: QR disponible            │
│                                     │
│ Escanea el código QR con WhatsApp  │
│ [Ver código QR] [Regenerar QR]      │
└─────────────────────────────────────┘
```

### Conectado:
```
┌─────────────────────────────────────┐
│ Conexión WhatsApp                   │
├─────────────────────────────────────┤
│ 🟢 Estado: Conectado                │
│                                     │
│ Número conectado:                   │
│ +52 123 456 7890                    │
│                                     │
│ [Desconectar]                       │
└─────────────────────────────────────┘
```

---

## 🔐 Seguridad e Independencia

### ✅ Tu Negocio tiene:
- ✅ **Su propio código QR** - No compartes QR con otros negocios
- ✅ **Su propia conexión** - Conexión independiente de otros tenants
- ✅ **Sus propios leads** - Solo ves los contactos de tu negocio
- ✅ **Sus propios mensajes** - Solo ves conversaciones de tu negocio
- ✅ **Su propia configuración** - Secuencias y triggers independientes

### ❌ Lo que NO verás:
- ❌ Leads de otros negocios
- ❌ Mensajes de otros negocios
- ❌ QR codes de otros negocios
- ❌ Configuración de otros negocios

---

## 🔧 Problemas Comunes

### ❓ "No aparece el botón Ver código QR"

**Solución:**
1. Espera 10 segundos después de hacer click en "Conectar"
2. Refresca la página (F5)
3. Si no aparece, click en "Regenerar QR"

---

### ❓ "El código QR expiró"

**Solución:**
1. Click en "Regenerar QR"
2. Se generará un nuevo código
3. Escanéalo rápidamente (los QR expiran en 60 segundos)

---

### ❓ "Ya escanee el QR pero sigue diciendo QR disponible"

**Solución:**
1. Espera 5 segundos para que actualice
2. Refresca la página
3. Debe cambiar a "Conectado"
4. Si no cambia, click en "Regenerar QR" y escanea de nuevo

---

### ❓ "Se desconectó después de unos días"

**Solución:**
1. Esto es normal si no se usa por varios días
2. Simplemente reconecta:
   - Click "Conectar WhatsApp"
   - Escanear nuevo QR
   - Listo

---

### ❓ "Quiero cambiar de número de WhatsApp"

**Solución:**
1. Click en "Desconectar" (botón rojo)
2. Confirma la desconexión
3. Click en "Conectar WhatsApp"
4. Escanea con el nuevo número

---

## 📞 Flujo Completo de Uso

### Primera Conexión:
```
1. Login → Configuración → WhatsApp
2. Conectar WhatsApp → Esperar QR
3. Ver código QR → Escanear con teléfono
4. ✅ Conectado
```

### Uso Diario:
```
1. Los mensajes llegan automáticamente
2. Los leads se crean automáticamente
3. Las secuencias se envían automáticamente
4. No necesitas hacer nada más
```

### Desconexión (opcional):
```
1. Configuración → WhatsApp
2. Desconectar → Confirmar
3. Tu número queda libre para otro CRM si lo necesitas
```

---

## 🎓 Tips y Mejores Prácticas

### ✅ Recomendaciones:

1. **Usa un número exclusivo del CRM**
   - No uses tu número personal
   - Usa una línea de WhatsApp Business dedicada

2. **Mantén la conexión activa**
   - No cierres WhatsApp Web en otros dispositivos
   - El CRM es otro "dispositivo vinculado"

3. **Verifica periódicamente**
   - Revisa el estado en Configuración cada semana
   - Asegúrate de que siga "Conectado"

4. **Backup de la sesión**
   - Tu sesión se guarda automáticamente
   - Persiste entre reinicios del servidor
   - No necesitas reconectar después de actualizaciones

### ❌ Evita:

1. ❌ Desconectar y reconectar frecuentemente
2. ❌ Escanear el mismo QR múltiples veces
3. ❌ Compartir tu código QR con otros
4. ❌ Usar el mismo número en múltiples CRMs

---

## 🆘 Soporte

Si tienes problemas que no se resuelven con esta guía:

1. Contacta a tu superadmin
2. Proporciona:
   - Nombre de tu negocio (tenant)
   - Captura de pantalla del error
   - Descripción de qué paso no funcionó

---

## 🎉 ¡Listo!

Una vez conectado, tu WhatsApp funcionará automáticamente:
- ✅ Recibirás mensajes en tiempo real
- ✅ Se crearán leads automáticamente
- ✅ Se activarán secuencias según configuración
- ✅ Podrás enviar mensajes desde el panel

**Disfruta de tu CRM de WhatsApp! 🚀**
