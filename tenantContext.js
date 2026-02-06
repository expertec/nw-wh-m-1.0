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

export async function listActiveTenantIds() {
  const snap = await tenantsCol().where('disabled', '!=', true).get();
  if (snap.empty) return [];
  return snap.docs.map((d) => d.id);
}
