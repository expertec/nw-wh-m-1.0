// tenantContext.js
// Helper para rutas Firestore bajo un tenant (multi-tenant con subcolecciones)
import { db } from './firebaseAdmin.js';

export const TENANTS_COLLECTION = 'tenants';
export const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'default';

export function requireTenantId(tenantId) {
  if (!tenantId) throw new Error('tenantId es obligatorio');
  return tenantId;
}

export function tenantsCol() {
  return db.collection(TENANTS_COLLECTION);
}

export function tenantDoc(tenantId) {
  return tenantsCol().doc(requireTenantId(tenantId));
}

export function leadsCol(tenantId) {
  return tenantDoc(tenantId).collection('leads');
}

export function secuenciasCol(tenantId) {
  return tenantDoc(tenantId).collection('secuencias');
}

export function sequenceQueueCol(tenantId) {
  return tenantDoc(tenantId).collection('sequenceQueue');
}

export function hashtagTriggersCol(tenantId) {
  return tenantDoc(tenantId).collection('hashtagTriggers');
}

export function messagesCol(tenantId, leadId) {
  return leadsCol(tenantId).doc(leadId).collection('messages');
}

export function configCol(tenantId) {
  return tenantDoc(tenantId).collection('config');
}

// Lee la configuración del tenant con fallback a config global
async function getTenantConfig(tenantId) {
  const tId = requireTenantId(tenantId);
  // 1) Intentar config del tenant
  const tenantCfg = await configCol(tId).doc('appConfig').get();
  if (tenantCfg.exists) return tenantCfg.data() || {};
  // 2) Fallback a config global (legacy)
  const globalCfg = await db.collection('config').doc('appConfig').get();
  return globalCfg.exists ? globalCfg.data() || {} : {};
}

// Lee los hashtag mappings del tenant con fallback a estáticos
async function getTenantHashtags(tenantId) {
  const tId = requireTenantId(tenantId);
  const doc = await configCol(tId).doc('hashtags').get();
  if (doc.exists) return doc.data() || {};
  return null; // null = usar estáticos
}

// Lee la configuración del agente IA del tenant
async function getAgentConfig(tenantId) {
  const tId = requireTenantId(tenantId);
  const doc = await configCol(tId).doc('aiAgent').get();
  return doc.exists ? doc.data() : null;
}

// Colección de contexto conversacional de IA por lead
export function aiContextCol(tenantId, leadId) {
  return leadsCol(tenantId).doc(leadId).collection('aiContext');
}

// Colección de integraciones externas por tenant
// Ruta: tenants/{tenantId}/integrations/{integrationName}
export function integrationsCol(tenantId) {
  return tenantDoc(tenantId).collection('integrations');
}

export { getTenantConfig, getTenantHashtags, getAgentConfig };

export async function listActiveTenantIds() {
  const snap = await tenantsCol().where('disabled', '!=', true).get();
  if (snap.empty) return [];
  return snap.docs.map((d) => d.id);
}
