import { aiContextCol } from '../tenantContext.js';
import { now } from '../firebaseAdmin.js';

/**
 * Gestiona el contexto conversacional de IA por lead
 * Mantiene historial de mensajes en Firestore para persistencia
 */
export const contextManager = {
  /**
   * Máximo de mensajes a mantener en el historial (rolling window)
   */
  MAX_HISTORY_SIZE: 20,

  /**
   * Obtiene el contexto conversacional de un lead
   * @param {string} tenantId - ID del tenant
   * @param {string} leadId - ID del lead
   * @returns {Object} Contexto con historial de mensajes y metadata
   */
  async getContext(tenantId, leadId) {
    try {
      // Obtener últimos mensajes del historial
      const snapshot = await aiContextCol(tenantId, leadId)
        .where('type', '==', 'message')
        .orderBy('timestamp', 'desc')
        .limit(this.MAX_HISTORY_SIZE)
        .get();

      const history = [];

      if (!snapshot.empty) {
        // Revertir orden para tener mensajes cronológicos (más antiguo → más reciente)
        const docs = snapshot.docs.reverse();

        for (const doc of docs) {
          const data = doc.data();
          history.push({
            role: data.role, // 'user' | 'assistant'
            content: data.content
          });
        }
      }

      // Obtener metadata
      const metadataDoc = await aiContextCol(tenantId, leadId)
        .doc('_metadata')
        .get();

      const metadata = metadataDoc.exists ? metadataDoc.data() : {
        totalInteractions: 0,
        totalTokensUsed: 0,
        lastAiResponseAt: null
      };

      return {
        history,
        metadata
      };
    } catch (error) {
      console.error('[ContextManager] Error obteniendo contexto:', error);
      return {
        history: [],
        metadata: {
          totalInteractions: 0,
          totalTokensUsed: 0,
          lastAiResponseAt: null
        }
      };
    }
  },

  /**
   * Agrega una interacción al historial conversacional
   * @param {string} tenantId - ID del tenant
   * @param {string} leadId - ID del lead
   * @param {Object} interaction - Datos de la interacción
   * @param {string} interaction.userMessage - Mensaje del usuario
   * @param {string} interaction.aiResponse - Respuesta del agente IA
   * @param {Array} interaction.toolsUsed - Tools ejecutados (opcional)
   * @param {number} interaction.tokensUsed - Tokens consumidos
   */
  async addInteraction(tenantId, leadId, interaction) {
    try {
      const timestamp = now();

      // Guardar mensaje del usuario
      await aiContextCol(tenantId, leadId).add({
        type: 'message',
        role: 'user',
        content: interaction.userMessage,
        timestamp
      });

      // Guardar respuesta del asistente
      await aiContextCol(tenantId, leadId).add({
        type: 'message',
        role: 'assistant',
        content: interaction.aiResponse,
        timestamp,
        toolsUsed: interaction.toolsUsed || [],
        tokensUsed: interaction.tokensUsed || 0
      });

      // Actualizar metadata
      const metadataRef = aiContextCol(tenantId, leadId).doc('_metadata');
      const metadataDoc = await metadataRef.get();

      if (metadataDoc.exists) {
        await metadataRef.update({
          totalInteractions: (metadataDoc.data().totalInteractions || 0) + 1,
          totalTokensUsed: (metadataDoc.data().totalTokensUsed || 0) + (interaction.tokensUsed || 0),
          lastAiResponseAt: timestamp
        });
      } else {
        await metadataRef.set({
          totalInteractions: 1,
          totalTokensUsed: interaction.tokensUsed || 0,
          lastAiResponseAt: timestamp
        });
      }

      // Limpiar historial si excede el límite
      await this._cleanOldMessages(tenantId, leadId);
    } catch (error) {
      console.error('[ContextManager] Error guardando interacción:', error);
    }
  },

  /**
   * Agrega un registro de ejecución de tool
   * @param {string} tenantId - ID del tenant
   * @param {string} leadId - ID del lead
   * @param {Object} toolExecution - Datos de la ejecución
   */
  async addToolExecution(tenantId, leadId, toolExecution) {
    try {
      await aiContextCol(tenantId, leadId).add({
        type: 'tool_execution',
        toolName: toolExecution.toolName,
        parameters: toolExecution.parameters || {},
        result: toolExecution.result || {},
        success: toolExecution.success !== false,
        timestamp: now()
      });
    } catch (error) {
      console.error('[ContextManager] Error guardando tool execution:', error);
    }
  },

  /**
   * Limpia el contexto conversacional de un lead
   * @param {string} tenantId - ID del tenant
   * @param {string} leadId - ID del lead
   */
  async clearContext(tenantId, leadId) {
    try {
      const snapshot = await aiContextCol(tenantId, leadId).get();

      // Eliminar todos los documentos en batch
      const batch = aiContextCol(tenantId, leadId).firestore.batch();

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      console.log(`[ContextManager] Contexto limpiado para lead ${leadId}`);
    } catch (error) {
      console.error('[ContextManager] Error limpiando contexto:', error);
    }
  },

  /**
   * Obtiene estadísticas del contexto conversacional
   * @param {string} tenantId - ID del tenant
   * @param {string} leadId - ID del lead
   * @returns {Object} Estadísticas
   */
  async getStats(tenantId, leadId) {
    try {
      const metadataDoc = await aiContextCol(tenantId, leadId)
        .doc('_metadata')
        .get();

      if (!metadataDoc.exists) {
        return {
          totalInteractions: 0,
          totalTokensUsed: 0,
          lastAiResponseAt: null
        };
      }

      return metadataDoc.data();
    } catch (error) {
      console.error('[ContextManager] Error obteniendo stats:', error);
      return {
        totalInteractions: 0,
        totalTokensUsed: 0,
        lastAiResponseAt: null
      };
    }
  },

  // Método privado para limpiar mensajes antiguos
  async _cleanOldMessages(tenantId, leadId) {
    try {
      const snapshot = await aiContextCol(tenantId, leadId)
        .where('type', '==', 'message')
        .orderBy('timestamp', 'desc')
        .get();

      // Si hay más de MAX_HISTORY_SIZE mensajes, eliminar los más antiguos
      if (snapshot.size > this.MAX_HISTORY_SIZE) {
        const batch = aiContextCol(tenantId, leadId).firestore.batch();
        const toDelete = snapshot.docs.slice(this.MAX_HISTORY_SIZE);

        toDelete.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();
      }
    } catch (error) {
      console.error('[ContextManager] Error limpiando mensajes antiguos:', error);
    }
  }
};
