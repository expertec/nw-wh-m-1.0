import { ToolInterface } from '../base/ToolInterface.js';
import {
  scheduleSequenceForLead,
  cancelSequences,
  cancelAllSequences,
  pauseSequences,
  resumeSequences,
} from '../../queue.js';
import { secuenciasCol } from '../../tenantContext.js';

export class SequenceTool extends ToolInterface {
  async execute({ tenantId, leadId, parameters }) {
    const { action, trigger } = parameters;

    console.log(`[SequenceTool] ${action} para lead ${leadId}, trigger: ${trigger || 'N/A'}`);

    switch (action) {
      case 'activate': {
        if (!trigger) {
          return { success: false, message: 'Se requiere el nombre de la secuencia (trigger)' };
        }
        const steps = await scheduleSequenceForLead(leadId, trigger, new Date(), tenantId);
        if (steps > 0) {
          await this.logToolExecution(tenantId, leadId, { action, trigger, steps, success: true });
          return { success: true, message: `Secuencia "${trigger}" activada con ${steps} pasos`, data: { trigger, steps } };
        }
        return { success: false, message: `No se pudo activar la secuencia "${trigger}". Puede que ya esté activa o no exista.` };
      }

      case 'cancel': {
        if (!trigger) {
          return { success: false, message: 'Se requiere el nombre de la secuencia (trigger) a cancelar' };
        }
        const cancelled = await cancelSequences(leadId, [trigger], tenantId);
        await this.logToolExecution(tenantId, leadId, { action, trigger, cancelled, success: true });
        return { success: true, message: `Secuencia "${trigger}" cancelada`, data: { trigger, cancelled } };
      }

      case 'cancel_all': {
        await cancelAllSequences(leadId, tenantId);
        await this.logToolExecution(tenantId, leadId, { action, success: true });
        return { success: true, message: 'Todas las secuencias canceladas' };
      }

      case 'pause': {
        await pauseSequences(leadId, tenantId);
        await this.logToolExecution(tenantId, leadId, { action, success: true });
        return { success: true, message: 'Secuencias pausadas' };
      }

      case 'resume': {
        await resumeSequences(leadId, tenantId);
        await this.logToolExecution(tenantId, leadId, { action, success: true });
        return { success: true, message: 'Secuencias reanudadas' };
      }

      case 'list': {
        const snap = await secuenciasCol(tenantId).get();
        const sequences = snap.docs.map(d => ({
          name: d.id,
          active: d.data().active !== false,
          messageCount: (d.data().messages || []).length,
        }));
        return { success: true, message: `${sequences.length} secuencias disponibles`, data: { sequences } };
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
      name: 'manage_sequences',
      description: 'Gestiona secuencias de mensajes automatizados para el lead. Puede activar, cancelar, pausar, reanudar secuencias o listar las disponibles.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['activate', 'cancel', 'cancel_all', 'pause', 'resume', 'list'],
            description: 'Accion a realizar: activate (activar secuencia), cancel (cancelar una), cancel_all (cancelar todas), pause, resume, list (listar disponibles)',
          },
          trigger: {
            type: 'string',
            description: 'Nombre de la secuencia (requerido para activate y cancel). Usa "list" primero para ver las disponibles.',
          },
        },
        required: ['action'],
      },
    };
  }
}

import { toolRegistry } from '../toolRegistry.js';
toolRegistry.register(new SequenceTool());
