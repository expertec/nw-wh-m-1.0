// lib/firestore.ts - Helpers para colecciones Firestore por tenant
import { collection, doc } from 'firebase/firestore';
import { firestore } from './firebase';

export function tenantDoc(tenantId: string) {
  return doc(firestore, 'tenants', tenantId);
}

export function leadsCol(tenantId: string) {
  return collection(firestore, 'tenants', tenantId, 'leads');
}

export function leadDoc(tenantId: string, leadId: string) {
  return doc(firestore, 'tenants', tenantId, 'leads', leadId);
}

export function messagesCol(tenantId: string, leadId: string) {
  return collection(firestore, 'tenants', tenantId, 'leads', leadId, 'messages');
}

export function secuenciasCol(tenantId: string) {
  return collection(firestore, 'tenants', tenantId, 'secuencias');
}

export function secuenciaDoc(tenantId: string, seqId: string) {
  return doc(firestore, 'tenants', tenantId, 'secuencias', seqId);
}
