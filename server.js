// server.js - WhatsApp CRM + Automatización de Secuencias
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import cron from 'node-cron';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

dotenv.config();

// ================ FFmpeg ================
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// ================ Firebase / WhatsApp ================
import { admin } from './firebaseAdmin.js';
import { requireAuth, requireTenantMatch, requireRole } from './authMiddleware.js';
import {
  DEFAULT_TENANT_ID,
  leadsCol,
  secuenciasCol,
  configCol,
  tenantsCol,
  tenantDoc,
  requireTenantId,
  listActiveTenantIds,
} from './tenantContext.js';
import {
  connectToWhatsApp,
  disconnectWhatsApp,
  getLatestQR,
  getConnectionStatus,
  sendMessageToLead,
  getSessionPhone,
  sendAudioMessage,
  sendVideoNote,
} from './whatsappService.js';

// ================ Secuencias ================
import { processSequences } from './scheduler.js';

// ================ AI Agent ================
import aiAgentRoutes from './routes/aiAgentRoutes.js';
import integrationsRoutes from './routes/integrationsRoutes.js';

// ================ App base ================
const app = express();
const port = process.env.PORT || 3001;
const upload = multer({ dest: path.resolve('./uploads') });

// CORS
app.use(cors());

// Body parsers
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// ============== WEBHOOK PÚBLICO - DEBE ESTAR ANTES DEL MIDDLEWARE DE AUTH ==============
/**
 * Endpoint público para capturar leads desde formularios web externos
 * NO requiere autenticación JWT, solo validación de tenantId + apiKey
 *
 * IMPORTANTE: Este endpoint DEBE estar ANTES de app.use('/api', requireAuth)
 * porque los formularios externos no tienen token de Firebase
 */
app.post('/api/webhook/lead', async (req, res) => {
  try {
    const { tenantId, apiKey, nombre, telefono, email, ciudad, metrosCuadrados, mensaje, ...customFields } = req.body;

    // Validación de campos requeridos
    if (!nombre || !telefono) {
      return res.status(400).json({
        error: 'Campos requeridos: nombre, telefono',
        received: { nombre: !!nombre, telefono: !!telefono }
      });
    }

    // ✅ API Key OBLIGATORIA para seguridad
    if (!tenantId || !apiKey) {
      return res.status(400).json({
        error: 'Campos requeridos: tenantId, apiKey',
        message: 'Por seguridad, este endpoint requiere autenticación. Genera tu API Key en Settings → Formularios Web'
      });
    }

    // Validar API Key contra la config del tenant
    try {
      const configSnap = await configCol(tenantId).doc('appConfig').get();
      const config = configSnap.exists ? configSnap.data() : {};

      if (!config.webhookApiKey) {
        return res.status(403).json({
          error: 'Este tenant no tiene API Key configurada',
          message: 'Genera tu API Key en Settings → Formularios Web'
        });
      }

      if (config.webhookApiKey !== apiKey) {
        console.warn(`[Webhook] ❌ API Key inválida para tenant: ${tenantId}`);
        return res.status(403).json({ error: 'API Key inválida' });
      }

      console.log(`[Webhook] ✅ API Key validada para tenant: ${tenantId}`);
    } catch (err) {
      console.error(`[Webhook] Error validando apiKey:`, err);
      return res.status(500).json({ error: 'Error validando apiKey' });
    }

    const resolvedTenantId = requireTenantId(tenantId);

    // Normalizar teléfono
    const { normalizePhoneForWA } = await import('./queue.js');
    const normTelefono = normalizePhoneForWA(telefono);
    const jid = `${normTelefono}@s.whatsapp.net`;
    const leadId = `WA_${normTelefono}`;

    // Verificar si el lead ya existe
    const leadRef = leadsCol(resolvedTenantId).doc(leadId);
    const leadSnap = await leadRef.get();

    const now = () => admin.firestore.Timestamp.now();

    // Obtener trigger por defecto del tenant
    const configSnap = await configCol(resolvedTenantId).doc('appConfig').get();
    const tenantConfig = configSnap.exists ? configSnap.data() : {};
    const defaultTrigger = tenantConfig.defaultTrigger || 'NuevoLeadWeb';

    const leadData = {
      telefono: normTelefono,
      nombre: nombre.trim(),
      jid,
      email: email || null,
      ciudad: ciudad || null,
      metrosCuadrados: metrosCuadrados || null,
      mensaje: mensaje || null,
      customFields: Object.keys(customFields).length > 0 ? customFields : null,
      source: 'Formulario Web',
      lastMessageAt: now(),
    };

    if (!leadSnap.exists) {
      // Crear lead nuevo
      await leadRef.set({
        ...leadData,
        fecha_creacion: now(),
        estado: 'nuevo',
        etiquetas: ['Web', defaultTrigger],
        unreadCount: 0,
        hasActiveSequences: false,
        seqPaused: false,
        secuenciasActivas: [],
      });

      console.log(`[Webhook] ✅ Lead creado: ${leadId} | tenant: ${resolvedTenantId} | trigger: ${defaultTrigger}`);

      // Activar secuencia automática
      try {
        const { scheduleSequenceForLead } = await import('./queue.js');
        await scheduleSequenceForLead(leadId, defaultTrigger, now(), resolvedTenantId);
        console.log(`[Webhook] 🎯 Secuencia ${defaultTrigger} programada para ${leadId}`);
      } catch (seqErr) {
        console.error(`[Webhook] ⚠️  Error programando secuencia:`, seqErr);
        // No fallar la request si la secuencia falla
      }

      return res.status(201).json({
        success: true,
        message: 'Lead creado y secuencia activada',
        leadId,
        trigger: defaultTrigger,
      });
    } else {
      // Lead existente: actualizar datos
      await leadRef.update({
        ...leadData,
        lastMessageAt: now(),
      });

      console.log(`[Webhook] ✅ Lead actualizado: ${leadId} | tenant: ${resolvedTenantId}`);

      return res.status(200).json({
        success: true,
        message: 'Lead actualizado',
        leadId,
      });
    }

  } catch (err) {
    console.error('[Webhook] ❌ Error procesando lead:', err);
    return res.status(500).json({
      error: 'Error interno del servidor',
      details: err.message
    });
  }
});

// Auth (Firebase ID token → tenant + rol) + validación de tenant
app.use('/api', requireAuth, requireTenantMatch);

function getTenantId(req) {
  return requireTenantId(
    req.tenantId ||
    DEFAULT_TENANT_ID
  );
}

// ============== RUTAS ==============

// Ruta de bienvenida
app.get('/', (_req, res) => {
  res.json({ message: 'WhatsApp CRM Server activo' });
});

// ============== AI AGENT ROUTES ==============
app.use('/api/ai-agent', aiAgentRoutes);

// ============== INTEGRATIONS ROUTES ==============
app.use('/api/integrations', integrationsRoutes);

// ============== TENANT MANAGEMENT (superadmin) ==============

// Listar tenants
app.get('/api/tenants', requireRole(['superadmin']), async (req, res) => {
  try {
    const snap = await tenantsCol().get();
    const tenants = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ tenants });
  } catch (err) {
    console.error('Error listando tenants:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Obtener tenant por ID
app.get('/api/tenants/:id', async (req, res) => {
  try {
    const tId = req.params.id;
    // Solo superadmin puede ver otros tenants
    if (tId !== req.tenantId && req.role !== 'superadmin') {
      return res.status(403).json({ error: 'No tienes acceso a este tenant' });
    }
    const doc = await tenantDoc(tId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Tenant no encontrado' });
    return res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error('Error obteniendo tenant:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Crear tenant (superadmin)
app.post('/api/tenants', requireRole(['superadmin']), async (req, res) => {
  try {
    const { id, nombre, plan, ownerEmail, ownerPassword } = req.body;
    if (!id || !nombre) {
      return res.status(400).json({ error: 'Faltan id y nombre' });
    }

    const existing = await tenantDoc(id).get();
    if (existing.exists) {
      return res.status(409).json({ error: 'Ya existe un tenant con ese ID' });
    }

    const tenantData = {
      nombre,
      plan: plan || 'basico',
      ownerEmail: ownerEmail || null,
      disabled: false,
      createdAt: new Date(),
    };

    // Crear tenant en Firestore
    await tenantDoc(id).set(tenantData);

    // Crear config por defecto del tenant
    await configCol(id).doc('appConfig').set({
      defaultTrigger: 'NuevoLeadWeb',
      defaultTriggerMetaAds: 'WebPromo',
    });

    // Crear usuario admin para el tenant (si se proporciona email)
    let createdUser = null;
    let userCreationError = null;
    if (ownerEmail) {
      try {
        // Generar password: mínimo 8 caracteres para cumplir requisitos de Firebase
        const randomPart = Math.random().toString(36).slice(2, 10);
        const password = ownerPassword || `${id}_${randomPart}`.substring(0, 20);

        // Verificar que la contraseña tenga al menos 6 caracteres
        if (password.length < 6) {
          throw new Error('La contraseña debe tener al menos 6 caracteres');
        }

        const userRecord = await admin.auth().createUser({
          email: ownerEmail,
          password: password,
          emailVerified: false,
        });

        // Asignar custom claims (role: admin, tenantId)
        await admin.auth().setCustomUserClaims(userRecord.uid, {
          role: 'admin',
          tenantId: id,
        });

        createdUser = {
          uid: userRecord.uid,
          email: ownerEmail,
          password: ownerPassword ? undefined : password, // Solo devolver password si fue autogenerado
        };

        console.log(`✅ Usuario admin creado para tenant ${id}: ${ownerEmail}`);
      } catch (userErr) {
        console.error('Error creando usuario admin:', userErr);
        userCreationError = userErr.message || 'Error desconocido al crear usuario';
        // No fallar la creación del tenant si falla el usuario
      }
    }

    return res.status(201).json({
      tenant: { id, ...tenantData },
      createdUser: createdUser,
      userCreationError: userCreationError,
    });
  } catch (err) {
    console.error('Error creando tenant:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Sincronizar usuarios de Firebase Auth con tenants (superadmin)
app.post('/api/tenants/sync-users', requireRole(['superadmin']), async (req, res) => {
  try {
    const tenantsSnap = await tenantsCol().get();
    const tenants = tenantsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const authUsers = await admin.auth().listUsers(1000);
    const authEmails = new Set(authUsers.users.map(u => u.email));

    const results = {
      total: tenants.length,
      created: [],
      skipped: [],
      errors: [],
    };

    for (const tenant of tenants) {
      const { id, ownerEmail, nombre } = tenant;

      if (!ownerEmail) {
        results.skipped.push({ id, reason: 'Sin ownerEmail' });
        continue;
      }

      if (authEmails.has(ownerEmail)) {
        results.skipped.push({ id, email: ownerEmail, reason: 'Usuario ya existe' });
        continue;
      }

      try {
        const password = `${id}_${Math.random().toString(36).slice(2, 10)}`;
        const userRecord = await admin.auth().createUser({
          email: ownerEmail,
          password: password,
          emailVerified: false,
          displayName: nombre || id,
        });

        await admin.auth().setCustomUserClaims(userRecord.uid, {
          role: 'admin',
          tenantId: id,
        });

        results.created.push({
          tenantId: id,
          email: ownerEmail,
          password: password,
          uid: userRecord.uid,
        });
      } catch (err) {
        results.errors.push({
          tenantId: id,
          email: ownerEmail,
          error: err.message,
        });
      }
    }

    return res.json(results);
  } catch (err) {
    console.error('Error sincronizando usuarios:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Actualizar tenant
app.patch('/api/tenants/:id', requireRole(['superadmin']), async (req, res) => {
  try {
    const tId = req.params.id;
    const doc = await tenantDoc(tId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Tenant no encontrado' });

    const allowed = ['nombre', 'plan', 'ownerEmail', 'disabled'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Sin campos válidos para actualizar' });
    }

    updates.updatedAt = new Date();
    await tenantDoc(tId).update(updates);
    return res.json({ id: tId, ...updates });
  } catch (err) {
    console.error('Error actualizando tenant:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Obtener config del tenant
app.get('/api/tenant-config', async (req, res) => {
  try {
    const tId = getTenantId(req);
    const cfgDoc = await configCol(tId).doc('appConfig').get();
    const cfg = cfgDoc.exists ? cfgDoc.data() : {};
    return res.json({ tenantId: tId, config: cfg });
  } catch (err) {
    console.error('Error obteniendo config:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Actualizar config del tenant
app.patch('/api/tenant-config', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const tId = getTenantId(req);
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Falta objeto config' });
    }
    await configCol(tId).doc('appConfig').set(config, { merge: true });
    return res.json({ success: true, tenantId: tId });
  } catch (err) {
    console.error('Error actualizando config:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Obtener hashtags del tenant
app.get('/api/tenant-config/hashtags', async (req, res) => {
  try {
    const tId = getTenantId(req);
    const doc = await configCol(tId).doc('hashtags').get();
    const data = doc.exists ? doc.data() : { hashtagMap: {}, cancelByTrigger: {} };
    return res.json({ tenantId: tId, hashtags: data });
  } catch (err) {
    console.error('Error obteniendo hashtags:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Actualizar hashtags del tenant
app.put('/api/tenant-config/hashtags', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const tId = getTenantId(req);
    const { hashtagMap, cancelByTrigger } = req.body;
    if (!hashtagMap || typeof hashtagMap !== 'object') {
      return res.status(400).json({ error: 'Falta hashtagMap (objeto)' });
    }
    const data = {
      hashtagMap,
      cancelByTrigger: cancelByTrigger || {},
      updatedAt: new Date(),
    };
    await configCol(tId).doc('hashtags').set(data);
    return res.json({ success: true, tenantId: tId });
  } catch (err) {
    console.error('Error actualizando hashtags:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Conectar WhatsApp para un tenant (admin/superadmin)
app.post('/api/whatsapp/connect', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const tId = getTenantId(req);
    connectToWhatsApp(tId).catch(err =>
      console.error(`Error conectando WA tenant=${tId}:`, err)
    );
    return res.json({ success: true, message: `Conectando WhatsApp para tenant ${tId}` });
  } catch (err) {
    console.error('Error iniciando conexión WA:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Desconectar WhatsApp (cerrar socket + limpiar sesión para generar nuevo QR)
app.post('/api/whatsapp/disconnect', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const tId = getTenantId(req);
    await disconnectWhatsApp(tId);
    return res.json({ success: true, message: `WhatsApp desconectado para tenant ${tId}. Conecta nuevamente para generar un nuevo QR.` });
  } catch (err) {
    console.error('Error desconectando WA:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Diagnóstico de sesiones (superadmin)
app.get('/api/whatsapp/diagnostics', requireRole(['superadmin']), async (req, res) => {
  try {
    const authPath = process.env.AUTH_DATA_PATH || (process.env.NODE_ENV === 'production' ? '/var/data' : './auth_info');

    // Obtener todos los tenants de Firestore
    const tenantsSnap = await tenantsCol().get();
    const tenants = tenantsSnap.docs.map(d => ({ id: d.id, nombre: d.data().nombre }));

    const diagnostics = [];

    for (const tenant of tenants) {
      const tenantPath = path.join(authPath, tenant.id);
      const hasSession = fs.existsSync(tenantPath);
      const fileCount = hasSession ? fs.readdirSync(tenantPath).length : 0;
      const hasCreds = hasSession && fs.existsSync(path.join(tenantPath, 'creds.json'));

      diagnostics.push({
        tenantId: tenant.id,
        tenantName: tenant.nombre,
        sessionPath: tenantPath,
        hasSessionFolder: hasSession,
        filesCount: fileCount,
        hasCredentials: hasCreds,
        status: getConnectionStatus(tenant.id),
      });
    }

    return res.json({
      authBasePath: authPath,
      nodeEnv: process.env.NODE_ENV || 'development',
      tenants: diagnostics,
      diskInfo: {
        message: 'Ejecuta en la shell de Render: df -h | grep /var/data'
      }
    });
  } catch (err) {
    console.error('Error en diagnóstico:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ============== WHATSAPP ROUTES ==============

// WhatsApp status / número
app.get('/api/whatsapp/status', (req, res) => {
  const tenantId = getTenantId(req);
  const status = getConnectionStatus(tenantId);
  const qr = getLatestQR(tenantId);
  console.log(`📡 GET /api/whatsapp/status - tenant: ${tenantId}, status: ${status}, QR: ${qr ? qr.substring(0, 50) + '...' : 'null'}`);
  res.json({ status, qr, tenantId });
});

app.get('/api/whatsapp/number', (req, res) => {
  const tenantId = getTenantId(req);
  const phone = getSessionPhone(tenantId);
  if (phone) return res.json({ phone });
  return res.status(503).json({ error: 'WhatsApp no conectado' });
});

// Enviar mensaje manual
app.post('/api/whatsapp/send-message', async (req, res) => {
  const { leadId, message } = req.body;
  const tenantId = getTenantId(req);
  if (!leadId || !message)
    return res.status(400).json({ error: 'Faltan leadId o message' });

  try {
    const leadDoc = await leadsCol(tenantId).doc(leadId).get();
    if (!leadDoc.exists)
      return res.status(404).json({ error: 'Lead no encontrado' });
    const { telefono } = leadDoc.data() || {};
    if (!telefono)
      return res.status(400).json({ error: 'Lead sin teléfono' });
    const result = await sendMessageToLead(tenantId, telefono, message);
    return res.json(result);
  } catch (error) {
    console.error('Error enviando WhatsApp:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Enviar mensaje de prueba (con número directo)
app.post('/api/whatsapp/send-test-message', requireRole(['superadmin', 'admin']), async (req, res) => {
  const { telefono, message } = req.body;
  const tenantId = getTenantId(req);

  if (!telefono || !message) {
    return res.status(400).json({ error: 'Faltan telefono o message' });
  }

  try {
    const result = await sendMessageToLead(tenantId, telefono, message);
    return res.json(result);
  } catch (error) {
    console.error('Error enviando mensaje de prueba:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Enviar mensajes masivos
app.post('/api/whatsapp/send-bulk-message', async (req, res) => {
  const { phones, messages } = req.body;
  const tenantId = getTenantId(req);
  if (!phones || !Array.isArray(phones) || phones.length === 0 || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Faltan phones (array), messages (array)' });
  }

  const results = [];
  for (const phone of phones) {
    try {
      let delayAccum = 0;
      for (const msg of messages) {
        setTimeout(async () => {
          try {
            if (msg.type === 'texto') {
              await sendMessageToLead(tenantId, phone, msg.contenido);
            } else if (msg.type === 'imagen') {
              const { getWhatsAppSock } = await import('./whatsappService.js');
              const sock = getWhatsAppSock(tenantId);
              if (!sock) throw new Error('No hay conexión activa con WhatsApp');
              const { normalizePhoneForWA } = await import('./queue.js');
              const num = normalizePhoneForWA ? normalizePhoneForWA(phone) : phone;
              const jid = `${num}@s.whatsapp.net`;
              await sock.sendMessage(jid, {
                image: { url: msg.contenido },
                caption: msg.caption || ''
              });
            } else if (msg.type === 'audio') {
              await sendAudioMessage(tenantId, phone, msg.contenido, { ptt: true });
            } else if (msg.type === 'video') {
              const { getWhatsAppSock } = await import('./whatsappService.js');
              const sock = getWhatsAppSock(tenantId);
              if (!sock) throw new Error('No hay conexión activa con WhatsApp');
              const { normalizePhoneForWA } = await import('./queue.js');
              const num = normalizePhoneForWA ? normalizePhoneForWA(phone) : phone;
              const jid = `${num}@s.whatsapp.net`;
              await sock.sendMessage(jid, {
                video: { url: msg.contenido },
                caption: msg.caption || ''
              });
            }
          } catch (err) {
            console.error(`Error enviando ${msg.type} a ${phone}:`, err);
          }
        }, delayAccum);
        delayAccum += (msg.delay || 0) * 60 * 1000;
      }
      results.push({ phone, success: true });
    } catch (error) {
      console.error(`Error programando para ${phone}:`, error);
      results.push({ phone, success: false, error: error.message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  return res.json({
    total: results.length,
    success: successCount,
    failed: failCount,
    results
  });
});

// Enviar secuencia masiva
app.post('/api/whatsapp/send-bulk-sequence', async (req, res) => {
  const { phones, sequenceId } = req.body;
  const tenantId = getTenantId(req);
  if (!phones || !Array.isArray(phones) || phones.length === 0 || !sequenceId) {
    return res.status(400).json({ error: 'Faltan phones (array), sequenceId' });
  }

  try {
    const seqDoc = await secuenciasCol(tenantId).doc(sequenceId).get();
    if (!seqDoc.exists) {
      return res.status(404).json({ error: 'Secuencia no encontrada' });
    }
    const sequence = seqDoc.data();
    const messages = sequence.messages || [];

    const results = [];
    for (const phone of phones) {
      try {
        let delayAccum = 0;
        for (const msg of messages) {
          setTimeout(async () => {
            try {
              if (msg.type === 'texto') {
                await sendMessageToLead(tenantId, phone, msg.contenido);
              } else if (msg.type === 'imagen') {
                const { getWhatsAppSock } = await import('./whatsappService.js');
                const sock = getWhatsAppSock(tenantId);
                if (!sock) throw new Error('No hay conexión activa con WhatsApp');
                const { normalizePhoneForWA } = await import('./queue.js');
                const num = normalizePhoneForWA ? normalizePhoneForWA(phone) : phone;
                const jid = `${num}@s.whatsapp.net`;
                await sock.sendMessage(jid, {
                  image: { url: msg.contenido },
                  caption: msg.caption || ''
                });
              } else if (msg.type === 'audio') {
                await sendAudioMessage(tenantId, phone, msg.contenido, { ptt: true });
              } else if (msg.type === 'video') {
                const { getWhatsAppSock } = await import('./whatsappService.js');
                const sock = getWhatsAppSock(tenantId);
                if (!sock) throw new Error('No hay conexión activa con WhatsApp');
                const { normalizePhoneForWA } = await import('./queue.js');
                const num = normalizePhoneForWA ? normalizePhoneForWA(phone) : phone;
                const jid = `${num}@s.whatsapp.net`;
                await sock.sendMessage(jid, {
                  video: { url: msg.contenido },
                  caption: msg.caption || ''
                });
              } else if (msg.type === 'videonota') {
                await sendVideoNote(tenantId, phone, msg.contenido, msg.seconds || null);
              } else if (msg.type === 'formulario') {
                await sendMessageToLead(tenantId, phone, msg.contenido);
              }
            } catch (err) {
              console.error(`Error enviando ${msg.type} a ${phone}:`, err);
            }
          }, delayAccum);
          delayAccum += (msg.delay || 0) * 60 * 1000;
        }
        results.push({ phone, success: true });
      } catch (error) {
        console.error(`Error programando para ${phone}:`, error);
        results.push({ phone, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    return res.json({
      total: results.length,
      success: successCount,
      failed: failCount,
      results
    });
  } catch (error) {
    console.error('Error obteniendo secuencia:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Enviar audio
app.post(
  '/api/whatsapp/send-audio',
  upload.single('audio'),
  async (req, res) => {
    const { phone, forwarded, ptt } = req.body;
    const tenantId = getTenantId(req);
    if (!phone || !req.file) {
      return res
        .status(400)
        .json({ success: false, error: 'Faltan phone o archivo' });
    }

    const uploadPath = req.file.path;
    const m4aPath = `${uploadPath}.m4a`;

    try {
      await new Promise((resolve, reject) => {
        ffmpeg(uploadPath)
          .outputOptions(['-c:a aac', '-vn'])
          .toFormat('mp4')
          .save(m4aPath)
          .on('end', resolve)
          .on('error', reject);
      });

      await sendAudioMessage(tenantId, phone, m4aPath, {
        ptt: String(ptt).toLowerCase() === 'true' || ptt === true,
        forwarded: String(forwarded).toLowerCase() === 'true' || forwarded === true,
      });

      try { fs.unlinkSync(uploadPath); } catch {}
      try { fs.unlinkSync(m4aPath); } catch {}

      return res.json({ success: true });
    } catch (error) {
      console.error('Error enviando audio:', error);
      try { fs.unlinkSync(uploadPath); } catch {}
      try { fs.unlinkSync(m4aPath); } catch {}
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Enviar video note (PTV)
app.post('/api/whatsapp/send-video-note', async (req, res) => {
  try {
    const { phone, url, seconds } = req.body || {};
    const tenantId = getTenantId(req);
    if (!phone || !url) {
      return res.status(400).json({ ok: false, error: 'Faltan phone y url' });
    }

    console.log(`[API] send-video-note → ${phone} ${url} s=${seconds ?? 'n/a'}`);
    await sendVideoNote(tenantId, phone, url, Number.isFinite(+seconds) ? +seconds : null);

    return res.json({ ok: true });
  } catch (e) {
    console.error('/api/whatsapp/send-video-note error:', e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// Marcar como leídos
app.post('/api/whatsapp/mark-read', async (req, res) => {
  const { leadId } = req.body;
  const tenantId = getTenantId(req);
  if (!leadId)
    return res.status(400).json({ error: 'Falta leadId' });
  try {
    await leadsCol(tenantId).doc(leadId).update({ unreadCount: 0 });
    return res.json({ success: true });
  } catch (err) {
    console.error('Error mark-read:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ============== WEBHOOK API KEY MANAGEMENT ==============

/**
 * Generar nueva API Key para webhook de formularios
 * Solo admin o superadmin pueden generar
 */
app.post('/api/webhook/generate-api-key', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const crypto = await import('crypto');

    // Generar API Key segura (64 caracteres hex)
    const apiKey = crypto.randomBytes(32).toString('hex');

    // Guardar en config del tenant
    const configRef = configCol(tenantId).doc('appConfig');
    await configRef.set({ webhookApiKey: apiKey }, { merge: true });

    console.log(`[Webhook] ✅ API Key generada para tenant: ${tenantId}`);

    return res.json({
      success: true,
      apiKey,
      message: 'API Key generada correctamente'
    });

  } catch (err) {
    console.error('[Webhook] Error generando API Key:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Obtener configuración actual del webhook
 * Incluye: tenantId, apiKey, webhookUrl
 */
app.get('/api/webhook/config', requireRole(['superadmin', 'admin']), async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    // Obtener config actual
    const configSnap = await configCol(tenantId).doc('appConfig').get();
    const config = configSnap.exists ? configSnap.data() : {};

    const webhookUrl = process.env.NODE_ENV === 'production'
      ? 'https://nw-wh-m-1-0.onrender.com/api/webhook/lead'
      : `http://localhost:${port}/api/webhook/lead`;

    return res.json({
      tenantId,
      apiKey: config.webhookApiKey || null,
      webhookUrl,
      hasApiKey: !!config.webhookApiKey
    });

  } catch (err) {
    console.error('[Webhook] Error obteniendo config:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ============== LEADS CRUD ==============

// Listar leads
app.get('/api/leads', async (req, res) => {
  const tenantId = getTenantId(req);
  const { estado, etiqueta, search, limit: lim = '100' } = req.query;
  try {
    let q = leadsCol(tenantId).orderBy('lastMessageAt', 'desc').limit(Math.min(+lim || 100, 500));
    if (estado) q = leadsCol(tenantId).where('estado', '==', estado).orderBy('lastMessageAt', 'desc').limit(Math.min(+lim || 100, 500));
    const snap = await q.get();
    let leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (etiqueta) leads = leads.filter(l => Array.isArray(l.etiquetas) && l.etiquetas.includes(etiqueta));
    if (search) {
      const s = String(search).toLowerCase();
      leads = leads.filter(l => (l.nombre || '').toLowerCase().includes(s) || (l.telefono || '').includes(s));
    }
    return res.json({ leads });
  } catch (err) {
    console.error('Error listando leads:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Obtener lead por ID
app.get('/api/leads/:id', async (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const doc = await leadsCol(tenantId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Lead no encontrado' });
    return res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Actualizar lead
app.patch('/api/leads/:id', async (req, res) => {
  const tenantId = getTenantId(req);
  const allowed = ['estado', 'etiquetas', 'nombre', 'seqPaused', 'stopSequences'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Sin campos válidos' });
  }
  try {
    await leadsCol(tenantId).doc(req.params.id).update(updates);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Mensajes de un lead
app.get('/api/leads/:id/messages', async (req, res) => {
  const tenantId = getTenantId(req);
  const { limit: lim = '100' } = req.query;
  try {
    const snap = await leadsCol(tenantId).doc(req.params.id)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(Math.min(+lim || 100, 500))
      .get();
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ messages: messages.reverse() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Activar secuencia para un lead
app.post('/api/leads/:id/sequences', async (req, res) => {
  const tenantId = getTenantId(req);
  const { trigger } = req.body;
  if (!trigger) return res.status(400).json({ error: 'Falta trigger' });
  try {
    const { scheduleSequenceForLead } = await import('./queue.js');
    const count = await scheduleSequenceForLead(req.params.id, trigger, new Date(), tenantId);
    return res.json({ success: true, stepsScheduled: count });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Cancelar secuencias de un lead
app.delete('/api/leads/:id/sequences', async (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const { cancelAllSequences } = await import('./queue.js');
    await cancelAllSequences(req.params.id, tenantId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Pausar secuencias
app.post('/api/leads/:id/pause', async (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const { pauseSequences } = await import('./queue.js');
    await pauseSequences(req.params.id, tenantId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Reanudar secuencias
app.post('/api/leads/:id/resume', async (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const { resumeSequences } = await import('./queue.js');
    await resumeSequences(req.params.id, tenantId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============== SEQUENCES CRUD ==============

app.get('/api/sequences', async (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const snap = await secuenciasCol(tenantId).get();
    const sequences = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ sequences });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/sequences/:id', async (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const doc = await secuenciasCol(tenantId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Secuencia no encontrada' });
    return res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/sequences', requireRole(['superadmin', 'admin']), async (req, res) => {
  const tenantId = getTenantId(req);
  const { id, trigger, active, messages } = req.body;
  if (!id || !trigger) return res.status(400).json({ error: 'Faltan id y trigger' });
  try {
    await secuenciasCol(tenantId).doc(id).set({
      trigger,
      active: active !== false,
      messages: Array.isArray(messages) ? messages : [],
      createdAt: new Date(),
    });
    return res.status(201).json({ id, trigger });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/sequences/:id', requireRole(['superadmin', 'admin']), async (req, res) => {
  const tenantId = getTenantId(req);
  const { trigger, active, messages } = req.body;
  try {
    const doc = await secuenciasCol(tenantId).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Secuencia no encontrada' });
    const updates = { updatedAt: new Date() };
    if (trigger !== undefined) updates.trigger = trigger;
    if (active !== undefined) updates.active = active;
    if (messages !== undefined) updates.messages = messages;
    await secuenciasCol(tenantId).doc(req.params.id).update(updates);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sequences/:id', requireRole(['superadmin', 'admin']), async (req, res) => {
  const tenantId = getTenantId(req);
  try {
    await secuenciasCol(tenantId).doc(req.params.id).delete();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============== DASHBOARD STATS ==============

app.get('/api/dashboard/stats', async (req, res) => {
  const tenantId = getTenantId(req);
  try {
    const allSnap = await leadsCol(tenantId).get();
    const total = allSnap.size;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let nuevosHoy = 0;
    let conSecuencia = 0;
    let sinLeer = 0;

    allSnap.docs.forEach(d => {
      const data = d.data();
      const created = data.fecha_creacion?.toDate?.() || data.fecha_creacion;
      if (created && new Date(created) >= today) nuevosHoy++;
      if (data.hasActiveSequences) conSecuencia++;
      if ((data.unreadCount || 0) > 0) sinLeer++;
    });

    return res.json({
      totalLeads: total,
      nuevosHoy,
      conSecuenciaActiva: conSecuencia,
      sinLeer,
      whatsappStatus: getConnectionStatus(tenantId),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ============== Arranque servidor + WA ==============
app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
  // Auto-connect: solo reconectar tenants que ya tienen sesión guardada
  (async () => {
    try {
      const tenants = await listActiveTenantIds();
      const targets = tenants.length ? tenants : [DEFAULT_TENANT_ID];
      const authPath = process.env.AUTH_DATA_PATH || (process.env.NODE_ENV === 'production' ? '/var/data' : './auth_info');
      for (const t of targets) {
        const tenantAuthPath = path.join(authPath, t, 'creds.json');
        if (fs.existsSync(tenantAuthPath)) {
          console.log(`[WA] Auto-connect: reconectando tenant ${t} (sesión existente)`);
          connectToWhatsApp(t).catch((err) =>
            console.error(`Error al conectar WhatsApp tenant=${t} en startup:`, err)
          );
        } else {
          console.log(`[WA] Skipping tenant ${t}: sin sesión guardada`);
        }
      }
    } catch (err) {
      console.error('Error listando tenants para conectar WA:', err);
    }
  })();
});

// ============== CRON JOBS ==============
// Procesar secuencias cada 30 segundos
cron.schedule('*/30 * * * * *', async () => {
  const tenants = await listActiveTenantIds().catch(() => []);
  const targets = (tenants && tenants.length) ? tenants : [DEFAULT_TENANT_ID];
  for (const t of targets) {
    processSequences(t).catch((err) =>
      console.error(`Error en processSequences tenant=${t}:`, err)
    );
  }
});
