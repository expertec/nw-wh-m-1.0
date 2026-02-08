// scheduler.js - Motor de secuencias automatizadas

import { getWhatsAppSock } from './whatsappService.js';
import * as Q from './queue.js';
import { DEFAULT_TENANT_ID, requireTenantId } from './tenantContext.js';

// =============== HELPERS ===============
function firstName(n = '') {
  return String(n).trim().split(/\s+/)[0] || '';
}

function replacePlaceholders(template, leadData) {
  const str = String(template || '');
  return str.replace(/\{\{(\w+)\}\}/g, (_, field) => {
    const value = leadData?.[field] || '';
    if (field === 'nombre') return firstName(value);
    return value;
  });
}

// =============== ENVÍO POR WHATSAPP ===============

export async function enviarMensaje(lead, mensaje, tenantId = DEFAULT_TENANT_ID) {
  try {
    const sock = getWhatsAppSock(tenantId);
    if (!sock) return;

    const { jid, phone } = Q.resolveLeadJidAndPhone(lead);
    if (!jid) {
      console.warn('[enviarMensaje] No se pudo resolver JID para lead', lead?.id || lead?.telefono);
      return;
    }

    switch ((mensaje?.type || 'texto').toLowerCase()) {
      case 'texto': {
        const text = replacePlaceholders(mensaje.contenido, lead).trim();
        if (text) await sock.sendMessage(jid, { text, linkPreview: false }, { timeoutMs: 120_000 });
        break;
      }
      case 'formulario': {
        const raw = String(mensaje.contenido || '');
        const text = raw
          .replace('{{telefono}}', String(phone || '').replace(/\D/g, ''))
          .replace('{{nombre}}', encodeURIComponent(lead.nombre || ''))
          .replace(/\r?\n/g, ' ')
          .trim();
        if (text) await sock.sendMessage(jid, { text, linkPreview: false }, { timeoutMs: 120_000 });
        break;
      }
      case 'audio': {
        const audioUrl = replacePlaceholders(mensaje.contenido, lead).trim();
        if (audioUrl) {
          await sock.sendMessage(jid, { audio: { url: audioUrl }, ptt: true });
        }
        break;
      }
      case 'imagen': {
        const url = replacePlaceholders(mensaje.contenido, lead).trim();
        if (url) await sock.sendMessage(jid, { image: { url } });
        break;
      }
      case 'video': {
        const url = replacePlaceholders(mensaje.contenido, lead).trim();
        if (url) await sock.sendMessage(jid, { video: { url } }, { timeoutMs: 120_000 });
        break;
      }
      default:
        console.warn('Tipo desconocido:', mensaje?.type);
    }
  } catch (err) {
    console.error('Error al enviar mensaje:', err);
  }
}

// =============== SECUENCIAS ===============

export async function processSequences(tenantId = DEFAULT_TENANT_ID) {
  const tId = requireTenantId(tenantId);
  if (typeof Q.processSequenceLeadsBatch === 'function') {
    return await Q.processSequenceLeadsBatch({ limit: 25, tenantId: tId });
  }
  if (typeof Q.processDueSequenceJobs === 'function') {
    return await Q.processDueSequenceJobs({ limit: 25, tenantId: tId });
  }
  if (typeof Q.processQueue === 'function') {
    return await Q.processQueue({ batchSize: 200, tenantId: tId });
  }
  console.warn('No hay función de proceso de cola exportada.');
  return 0;
}
