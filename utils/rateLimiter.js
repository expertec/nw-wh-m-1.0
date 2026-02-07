import { configCol } from '../tenantContext.js';
import { FieldValue } from '../firebaseAdmin.js';

/**
 * Rate Limiter para controlar costos y uso de API de IA por tenant
 */
export class AIRateLimiter {
  /**
   * Límites por defecto (pueden ser configurados por tenant)
   */
  static DEFAULT_LIMITS = {
    messagesPerLeadPerDay: 50,
    toolCallsPerDay: 100,
    tokensPerDay: 1000000 // 1M tokens
  };

  /**
   * Verifica si un tenant/lead puede realizar una operación
   * @param {string} tenantId - ID del tenant
   * @param {string} leadId - ID del lead
   * @param {string} operation - Tipo de operación: 'message' | 'tool_call'
   * @throws {Error} Si se excede el rate limit
   */
  static async checkLimit(tenantId, leadId, operation) {
    const today = this._getTodayKey();

    try {
      const usageDoc = await configCol(tenantId).doc('aiUsage').get();
      const usage = usageDoc.exists ? usageDoc.data() : {};

      // Obtener límites configurados para este tenant
      const limits = await this._getTenantLimits(tenantId);

      // Verificar límite según tipo de operación
      if (operation === 'message' && leadId) {
        const leadKey = `leads.${leadId}.${today}`;
        const leadMessages = usage[leadKey] || 0;

        if (leadMessages >= limits.messagesPerLeadPerDay) {
          throw new Error(`Rate limit excedido: máximo ${limits.messagesPerLeadPerDay} mensajes por lead por día`);
        }
      }

      if (operation === 'tool_call') {
        const toolKey = `toolCalls.${today}`;
        const toolCalls = usage[toolKey] || 0;

        if (toolCalls >= limits.toolCallsPerDay) {
          throw new Error(`Rate limit excedido: máximo ${limits.toolCallsPerDay} tool calls por día`);
        }
      }

      return true;
    } catch (error) {
      // Si el error es de rate limit, propagarlo
      if (error.message.includes('Rate limit excedido')) {
        throw error;
      }

      // Otros errores (ej: Firestore), log pero no bloquear
      console.error('[RateLimiter] Error verificando límites:', error);
      return true; // Permitir operación si falla la verificación
    }
  }

  /**
   * Incrementa el contador de uso después de una operación exitosa
   * @param {string} tenantId - ID del tenant
   * @param {string} leadId - ID del lead (opcional)
   * @param {string} operation - Tipo de operación: 'message' | 'tool_call'
   * @param {Object} cost - Información de costo: { tokens: number }
   */
  static async incrementUsage(tenantId, leadId, operation, cost = {}) {
    const today = this._getTodayKey();
    const updates = {};

    try {
      if (operation === 'message' && leadId) {
        const leadKey = `leads.${leadId}.${today}`;
        updates[leadKey] = FieldValue.increment(1);
      }

      if (operation === 'tool_call') {
        const toolKey = `toolCalls.${today}`;
        updates[toolKey] = FieldValue.increment(1);
      }

      if (cost.tokens) {
        const tokenKey = `tokens.${today}`;
        updates[tokenKey] = FieldValue.increment(cost.tokens);
      }

      if (Object.keys(updates).length > 0) {
        await configCol(tenantId).doc('aiUsage').set(updates, { merge: true });
      }
    } catch (error) {
      // Log error pero no fallar la operación
      console.error('[RateLimiter] Error incrementando uso:', error);
    }
  }

  /**
   * Obtiene estadísticas de uso de IA para un tenant
   * @param {string} tenantId - ID del tenant
   * @param {string} date - Fecha en formato YYYY-MM-DD (opcional, default: hoy)
   * @returns {Object} Estadísticas de uso
   */
  static async getUsageStats(tenantId, date = null) {
    const dateKey = date || this._getTodayKey();

    try {
      const usageDoc = await configCol(tenantId).doc('aiUsage').get();
      const usage = usageDoc.exists ? usageDoc.data() : {};

      const toolCalls = usage[`toolCalls.${dateKey}`] || 0;
      const tokens = usage[`tokens.${dateKey}`] || 0;

      // Contar mensajes por lead
      let totalMessages = 0;
      const leadPattern = new RegExp(`^leads\\.[^.]+\\.${dateKey}$`);

      for (const key in usage) {
        if (leadPattern.test(key)) {
          totalMessages += usage[key];
        }
      }

      return {
        date: dateKey,
        messagesProcessed: totalMessages,
        toolCallsExecuted: toolCalls,
        tokensUsed: tokens,
        estimatedCost: this._estimateCost(tokens, toolCalls)
      };
    } catch (error) {
      console.error('[RateLimiter] Error obteniendo estadísticas:', error);
      return {
        date: dateKey,
        messagesProcessed: 0,
        toolCallsExecuted: 0,
        tokensUsed: 0,
        estimatedCost: 0
      };
    }
  }

  /**
   * Limpia estadísticas de uso antiguas (más de 30 días)
   * @param {string} tenantId - ID del tenant
   */
  static async cleanOldUsage(tenantId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffKey = this._formatDateKey(thirtyDaysAgo);

    try {
      const usageDoc = await configCol(tenantId).doc('aiUsage').get();
      if (!usageDoc.exists) return;

      const usage = usageDoc.data();
      const updates = {};
      let cleaned = 0;

      for (const key in usage) {
        // Extraer fecha de keys como "leads.xxx.2024-02-07" o "toolCalls.2024-02-07"
        const dateMatch = key.match(/\.(\d{4}-\d{2}-\d{2})$/);
        if (dateMatch && dateMatch[1] < cutoffKey) {
          updates[key] = FieldValue.delete();
          cleaned++;
        }
      }

      if (cleaned > 0) {
        await configCol(tenantId).doc('aiUsage').update(updates);
        console.log(`[RateLimiter] Limpiados ${cleaned} registros antiguos para tenant ${tenantId}`);
      }
    } catch (error) {
      console.error('[RateLimiter] Error limpiando uso antiguo:', error);
    }
  }

  // Métodos privados

  static _getTodayKey() {
    return this._formatDateKey(new Date());
  }

  static _formatDateKey(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  static async _getTenantLimits(tenantId) {
    try {
      const configDoc = await configCol(tenantId).doc('aiAgent').get();
      if (configDoc.exists) {
        const config = configDoc.data();
        return {
          messagesPerLeadPerDay: config.rateLimits?.maxMessagesPerLeadPerDay || this.DEFAULT_LIMITS.messagesPerLeadPerDay,
          toolCallsPerDay: config.rateLimits?.maxToolCallsPerDay || this.DEFAULT_LIMITS.toolCallsPerDay,
          tokensPerDay: config.rateLimits?.tokensPerDay || this.DEFAULT_LIMITS.tokensPerDay
        };
      }
    } catch (error) {
      console.error('[RateLimiter] Error obteniendo límites del tenant:', error);
    }

    return this.DEFAULT_LIMITS;
  }

  static _estimateCost(tokens, toolCalls) {
    // Precios GPT-4o (aproximados, Feb 2024)
    // Input: $5 / 1M tokens
    // Output: $15 / 1M tokens
    // Asumimos 50/50 input/output
    const avgPricePerToken = (5 + 15) / 2 / 1000000;
    const tokenCost = tokens * avgPricePerToken;

    // No hay costo adicional por tool calls en OpenAI
    // (solo los tokens usados en la conversación)

    return parseFloat(tokenCost.toFixed(4)); // USD
  }
}
