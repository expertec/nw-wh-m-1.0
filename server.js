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
import { requireAuth } from './authMiddleware.js';
import {
  DEFAULT_TENANT_ID,
  leadsCol,
  secuenciasCol,
  requireTenantId,
  listActiveTenantIds,
} from './tenantContext.js';
import {
  connectToWhatsApp,
  getLatestQR,
  getConnectionStatus,
  sendMessageToLead,
  getSessionPhone,
  sendAudioMessage,
  sendVideoNote,
} from './whatsappService.js';

// ================ Secuencias ================
import { processSequences } from './scheduler.js';

// ================ App base ================
const app = express();
const port = process.env.PORT || 3001;
const upload = multer({ dest: path.resolve('./uploads') });

// CORS
app.use(cors());

// Body parsers
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Auth (Firebase ID token → tenant + rol)
app.use('/api', requireAuth);

function getTenantId(req) {
  return requireTenantId(
    req.tenantId ||
    req.headers['x-tenant-id'] ||
    req.body?.tenantId ||
    req.query?.tenantId ||
    DEFAULT_TENANT_ID
  );
}

// ============== RUTAS ==============

// Ruta de bienvenida
app.get('/', (_req, res) => {
  res.json({ message: 'WhatsApp CRM Server activo' });
});

// WhatsApp status / número
app.get('/api/whatsapp/status', (req, res) => {
  const tenantId = getTenantId(req);
  res.json({ status: getConnectionStatus(tenantId), qr: getLatestQR(tenantId), tenantId });
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

// ============== Arranque servidor + WA ==============
app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
  (async () => {
    try {
      const tenants = await listActiveTenantIds();
      const targets = tenants.length ? tenants : [DEFAULT_TENANT_ID];
      for (const t of targets) {
        connectToWhatsApp(t).catch((err) =>
          console.error(`Error al conectar WhatsApp tenant=${t} en startup:`, err)
        );
      }
    } catch (err) {
      console.error('Error listando tenants para conectar WA:', err);
      connectToWhatsApp(DEFAULT_TENANT_ID).catch(() => {});
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
