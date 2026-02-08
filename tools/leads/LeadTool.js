import { ToolInterface } from '../base/ToolInterface.js';
import { leadsCol } from '../../tenantContext.js';
import admin from 'firebase-admin';

const { FieldValue } = admin.firestore;

export class LeadTool extends ToolInterface {
  async execute({ tenantId, leadId, parameters }) {
    const { action, tags, status } = parameters;

    console.log(`[LeadTool] ${action} para lead ${leadId}`);

    const leadRef = leadsCol(tenantId).doc(leadId);

    switch (action) {
      case 'add_tags': {
        if (!tags || !tags.length) {
          return { success: false, message: 'Se requiere al menos una etiqueta' };
        }
        await leadRef.set({ etiquetas: FieldValue.arrayUnion(...tags) }, { merge: true });
        await this.logToolExecution(tenantId, leadId, { action, tags, success: true });
        return { success: true, message: `Etiquetas agregadas: ${tags.join(', ')}`, data: { tags } };
      }

      case 'remove_tags': {
        if (!tags || !tags.length) {
          return { success: false, message: 'Se requiere al menos una etiqueta a eliminar' };
        }
        await leadRef.set({ etiquetas: FieldValue.arrayRemove(...tags) }, { merge: true });
        await this.logToolExecution(tenantId, leadId, { action, tags, success: true });
        return { success: true, message: `Etiquetas eliminadas: ${tags.join(', ')}`, data: { tags } };
      }

      case 'set_status': {
        if (!status) {
          return { success: false, message: 'Se requiere el nuevo estado' };
        }
        await leadRef.set({ estado: status }, { merge: true });
        await this.logToolExecution(tenantId, leadId, { action, status, success: true });
        return { success: true, message: `Estado cambiado a: ${status}`, data: { status } };
      }

      case 'get_info': {
        const snap = await leadRef.get();
        if (!snap.exists) {
          return { success: false, message: 'Lead no encontrado' };
        }
        const data = snap.data();
        const info = {
          nombre: data.nombre || '',
          telefono: data.telefono || '',
          estado: data.estado || 'desconocido',
          etiquetas: data.etiquetas || [],
          secuenciasActivas: (data.secuenciasActivas || []).map(s => s.trigger),
          seqPaused: data.seqPaused || false,
          source: data.source || '',
          fecha_creacion: data.fecha_creacion || data.createdAt || null,
        };
        return { success: true, message: 'Info del lead obtenida', data: info };
      }

      default:
        return { success: false, message: `Accion desconocida: ${action}` };
    }
  }

  async verifyIntegration(tenantId) {
    return true;
  }

  getToolDefinition() {
    return {
      name: 'manage_lead',
      description: 'Gestiona la informacion del lead actual. Puede agregar/eliminar etiquetas, cambiar su estado, u obtener su informacion.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['add_tags', 'remove_tags', 'set_status', 'get_info'],
            description: 'Accion: add_tags (agregar etiquetas), remove_tags (eliminar etiquetas), set_status (cambiar estado), get_info (ver info del lead)',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Etiquetas a agregar o eliminar (para add_tags y remove_tags)',
          },
          status: {
            type: 'string',
            description: 'Nuevo estado del lead (para set_status). Ejemplos: nuevo, contactado, interesado, compro',
          },
        },
        required: ['action'],
      },
    };
  }
}

import { toolRegistry } from '../toolRegistry.js';
toolRegistry.register(new LeadTool());
