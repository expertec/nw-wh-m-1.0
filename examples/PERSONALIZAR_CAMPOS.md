# 🎨 Cómo Personalizar los Campos del Formulario

El webhook es **100% flexible** - puedes enviar los campos que necesites según tu negocio.

---

## 📋 Reglas Simples

### 1. Campos Obligatorios (siempre enviar)
```javascript
{
  tenantId: "tu-negocio",  // Identifica tu negocio
  nombre: "Juan Pérez",    // Nombre del lead
  telefono: "+52 33 1234"  // Teléfono/WhatsApp
}
```

### 2. Campos Predefinidos (opcionales)
Estos se guardan directamente en el lead:
```javascript
{
  email: "juan@example.com",
  ciudad: "Guadalajara",
  metrosCuadrados: "200",
  mensaje: "Comentario adicional"
}
```

### 3. Campos Personalizados (los que tú quieras)
**Cualquier otro campo** se guarda automáticamente:
```javascript
{
  // Tus campos personalizados 👇
  tipoServicio: "Impermeabilización",
  presupuesto: "500,000",
  urgencia: "Alta",
  origen: "Facebook",
  // ... lo que necesites
}
```

---

## 🎯 Ejemplos por Industria

### 🏠 Impermeabilización
```html
<!-- Campos específicos -->
<select name="tipoPropiedad">
  <option value="Casa">Casa</option>
  <option value="Edificio">Edificio</option>
  <option value="Bodega">Bodega</option>
</select>

<select name="tipoServicio">
  <option value="Azotea">Impermeabilización de azotea</option>
  <option value="Cisterna">Impermeabilización de cisterna</option>
  <option value="Baño">Impermeabilización de baño</option>
</select>

<select name="urgencia">
  <option value="Urgente">Urgente (esta semana)</option>
  <option value="Pronto">Pronto (este mes)</option>
  <option value="Planificando">Estoy planificando</option>
</select>
```

**Resultado en Firestore:**
```javascript
{
  nombre: "Juan Pérez",
  telefono: "523312345678",
  email: "juan@example.com",
  ciudad: "Guadalajara",
  customFields: {
    tipoPropiedad: "Casa",
    tipoServicio: "Azotea",
    urgencia: "Urgente"
  }
}
```

---

### 🏡 Inmobiliaria
```html
<select name="tipoOperacion">
  <option value="Comprar">Comprar</option>
  <option value="Rentar">Rentar</option>
  <option value="Vender">Vender mi propiedad</option>
</select>

<select name="tipoPropiedad">
  <option value="Casa">Casa</option>
  <option value="Departamento">Departamento</option>
  <option value="Terreno">Terreno</option>
</select>

<select name="presupuesto">
  <option value="0-1M">Hasta $1,000,000</option>
  <option value="1M-2M">$1,000,000 - $2,000,000</option>
  <option value="2M+">Más de $2,000,000</option>
</select>

<select name="recamaras">
  <option value="1">1</option>
  <option value="2">2</option>
  <option value="3+">3 o más</option>
</select>
```

---

### 🚗 Taller Mecánico
```html
<select name="tipoVehiculo">
  <option value="Auto">Auto</option>
  <option value="Camioneta">Camioneta</option>
  <option value="Moto">Moto</option>
</select>

<input type="text" name="marca" placeholder="Marca (ej: Toyota, Honda)">
<input type="text" name="modelo" placeholder="Modelo">
<input type="text" name="año" placeholder="Año">

<select name="tipoServicio">
  <option value="Mantenimiento">Mantenimiento preventivo</option>
  <option value="Reparación">Reparación</option>
  <option value="Diagnóstico">Diagnóstico</option>
</select>

<textarea name="problema" placeholder="Describe el problema o servicio que necesitas"></textarea>
```

---

### 🍕 Restaurante / Catering
```html
<select name="tipoEvento">
  <option value="Boda">Boda</option>
  <option value="Cumpleaños">Cumpleaños</option>
  <option value="Corporativo">Evento corporativo</option>
  <option value="Otro">Otro</option>
</select>

<input type="date" name="fechaEvento" placeholder="Fecha del evento">

<select name="numeroPersonas">
  <option value="10-30">10-30 personas</option>
  <option value="30-50">30-50 personas</option>
  <option value="50-100">50-100 personas</option>
  <option value="100+">Más de 100 personas</option>
</select>

<select name="tipoMenu">
  <option value="Buffet">Buffet</option>
  <option value="Servicio a mesa">Servicio a mesa</option>
  <option value="Cocktail">Cocktail</option>
</select>
```

---

### 🏋️ Gimnasio / Fitness
```html
<select name="objetivo">
  <option value="Bajar de peso">Bajar de peso</option>
  <option value="Tonificar">Tonificar / Definir</option>
  <option value="Aumentar masa">Aumentar masa muscular</option>
  <option value="Mejorar salud">Mejorar salud general</option>
</select>

<select name="experiencia">
  <option value="Principiante">Principiante</option>
  <option value="Intermedio">Intermedio</option>
  <option value="Avanzado">Avanzado</option>
</select>

<select name="disponibilidad">
  <option value="Mañana">Mañana (6am - 12pm)</option>
  <option value="Tarde">Tarde (12pm - 6pm)</option>
  <option value="Noche">Noche (6pm - 10pm)</option>
</select>
```

---

## 💻 Cómo Agregar Campos al HTML

### Paso 1: Agregar el campo al formulario
```html
<div class="form-group">
  <label>Nombre del campo</label>
  <input type="text" name="nombreCampo" placeholder="Placeholder">
  <!-- o -->
  <select name="nombreCampo">
    <option value="Opción 1">Opción 1</option>
    <option value="Opción 2">Opción 2</option>
  </select>
</div>
```

### Paso 2: El JavaScript lo envía automáticamente
No necesitas modificar el JavaScript. El código automáticamente toma todos los campos del formulario:

```javascript
const formData = new FormData(form);
const data = { tenantId: CONFIG.tenantId };

formData.forEach((value, key) => {
  if (value.trim()) {
    data[key] = value.trim();  // ✅ Automático
  }
});
```

### Paso 3: Se guarda automáticamente
El backend guarda todo en Firestore sin configuración adicional.

---

## 🎨 Tipos de Campos HTML

### Text Input
```html
<input type="text" name="nombreCampo" placeholder="Texto">
```

### Email
```html
<input type="email" name="email" placeholder="correo@example.com">
```

### Teléfono
```html
<input type="tel" name="telefono" placeholder="+52 33 1234 5678">
```

### Número
```html
<input type="number" name="edad" min="18" max="100">
```

### Fecha
```html
<input type="date" name="fechaEvento">
```

### Select / Dropdown
```html
<select name="opcion">
  <option value="">Selecciona...</option>
  <option value="Opción 1">Opción 1</option>
  <option value="Opción 2">Opción 2</option>
</select>
```

### Textarea
```html
<textarea name="comentarios" rows="4"></textarea>
```

### Checkbox (si está marcado)
```html
<label>
  <input type="checkbox" name="aceptaTerminos" value="Sí">
  Acepto términos y condiciones
</label>
```

### Radio Buttons
```html
<label>
  <input type="radio" name="genero" value="Masculino"> Masculino
</label>
<label>
  <input type="radio" name="genero" value="Femenino"> Femenino
</label>
```

---

## 📊 Cómo se Ven en el CRM

### En la lista de Leads
Verás los campos predefinidos directamente:
- Nombre
- Teléfono
- Email
- Ciudad
- Metros cuadrados

### Al abrir el Lead
Verás todos los campos personalizados en `customFields`:

```
Lead: Juan Pérez
Teléfono: +52 33 1234 5678
Email: juan@example.com
Ciudad: Guadalajara

Campos personalizados:
  • Tipo de propiedad: Casa
  • Tipo de servicio: Azotea
  • Urgencia: Urgente
  • Presupuesto: $500,000
  • Origen: Facebook
```

---

## ✅ Validación de Campos

### Frontend (HTML5)
```html
<!-- Campo requerido -->
<input type="text" name="nombre" required>

<!-- Email válido -->
<input type="email" name="email" required>

<!-- Teléfono con patrón -->
<input type="tel" name="telefono" pattern="[0-9\s+()-]+" required>

<!-- Número mínimo/máximo -->
<input type="number" name="edad" min="18" max="100">

<!-- Longitud mínima/máxima -->
<input type="text" name="comentarios" minlength="10" maxlength="500">
```

### JavaScript (adicional)
```javascript
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Validación personalizada
  const telefono = document.querySelector('[name="telefono"]').value;

  if (!telefono.match(/[0-9]{10,}/)) {
    alert('Teléfono inválido');
    return;
  }

  // Continuar con el envío...
});
```

---

## 🎯 Consejos

### ✅ Buenas Prácticas

1. **Usa `name` descriptivos**
   ```html
   ✅ <input name="presupuestoMensual">
   ❌ <input name="campo1">
   ```

2. **Campos opcionales vs requeridos**
   - Solo marca como `required` lo esencial (nombre, teléfono)
   - Más campos = menos conversiones

3. **Usa placeholders claros**
   ```html
   ✅ <input placeholder="+52 33 1234 5678">
   ❌ <input placeholder="Teléfono">
   ```

4. **Agrupa campos relacionados**
   ```html
   <fieldset>
     <legend>Datos del vehículo</legend>
     <input name="marca">
     <input name="modelo">
     <input name="año">
   </fieldset>
   ```

---

## 🧪 Probar tus Campos

1. Llena el formulario
2. Abre la consola del navegador (F12)
3. Verás el JSON que se envía:
   ```javascript
   {
     tenantId: "mi-negocio",
     nombre: "Juan",
     telefono: "+52 33 1234",
     // ... tus campos personalizados
   }
   ```
4. Revisa en el CRM que se guardó correctamente

---

## 📚 Ejemplos Listos para Usar

- `formulario-ejemplo.html` - Genérico
- `formulario-impermeabilizacion.html` - Negocio de impermeabilización
- `formulario-inmobiliaria.html` - Inmobiliaria

Copia el que más se parezca a tu negocio y personaliza los campos según tus necesidades.

---

¿Necesitas ayuda con campos específicos? Revisa los ejemplos o contacta al equipo de soporte.
