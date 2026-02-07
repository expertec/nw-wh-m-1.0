import { toolRegistry } from '../toolRegistry.js';
import { AIRateLimiter } from '../../utils/rateLimiter.js';

/**
 * Ejecutor de tools para el agente IA
 * Maneja la ejecución de múltiples tools en paralelo o secuencial
 */
export class ToolExecutor {
  /**
   * Ejecuta todos los tools solicitados por el agente IA
   * @param {Object} params - Parámetros
   * @param {string} params.tenantId - ID del tenant
   * @param {string} params.leadId - ID del lead
   * @param {Array} params.toolCalls - Array de tool calls desde OpenAI
   * @returns {Promise<Array>} Array de resultados
   *
   * toolCalls tiene el formato:
   * [
   *   {
   *     id: 'call_abc123',           // ID único del tool call (de OpenAI)
   *     toolName: 'create_calendar_event',
   *     parameters: { title: '...', startDateTime: '...' }
   *   }
   * ]
   *
   * Retorna:
   * [
   *   {
   *     id: 'call_abc123',           // Mismo ID para que OpenAI lo asocie
   *     toolName: 'create_calendar_event',
   *     result: { success: true, message: '...' }
   *   }
   * ]
   */
  static async executeAll({ tenantId, leadId, toolCalls }) {
    const results = [];

    console.log(`[ToolExecutor] Ejecutando ${toolCalls.length} tools para lead ${leadId}`);

    for (const call of toolCalls) {
      try {
        const result = await this.executeSingle({
          tenantId,
          leadId,
          toolCall: call
        });

        results.push(result);
      } catch (error) {
        console.error(`[ToolExecutor] Error ejecutando tool ${call.toolName}:`, error);

        // Agregar resultado de error
        results.push({
          id: call.id,
          toolName: call.toolName,
          result: {
            success: false,
            error: error.message || 'Error desconocido ejecutando tool'
          }
        });
      }
    }

    return results;
  }

  /**
   * Ejecuta un solo tool
   * @param {Object} params - Parámetros
   * @returns {Promise<Object>} Resultado del tool
   * @private
   */
  static async executeSingle({ tenantId, leadId, toolCall }) {
    const { id, toolName, parameters } = toolCall;

    console.log(`[ToolExecutor] Ejecutando tool: ${toolName}`, parameters);

    // 1. Verificar rate limit para tool calls
    try {
      await AIRateLimiter.checkLimit(tenantId, leadId, 'tool_call');
    } catch (rateLimitError) {
      return {
        id,
        toolName,
        result: {
          success: false,
          error: 'Límite de ejecuciones de herramientas alcanzado. Intenta más tarde.'
        }
      };
    }

    // 2. Obtener tool del registry
    const tool = toolRegistry.getTool(toolName);

    if (!tool) {
      console.error(`[ToolExecutor] Tool no encontrado: ${toolName}`);
      return {
        id,
        toolName,
        result: {
          success: false,
          error: `Herramienta "${toolName}" no disponible`
        }
      };
    }

    // 3. Validar parámetros
    const validation = tool.validateParameters(parameters);
    if (!validation.valid) {
      console.error(`[ToolExecutor] Parámetros inválidos para ${toolName}:`, validation.errors);
      return {
        id,
        toolName,
        result: {
          success: false,
          error: `Parámetros inválidos: ${validation.errors.join(', ')}`
        }
      };
    }

    // 4. Verificar que el tenant tiene la integración necesaria
    const hasIntegration = await tool.verifyIntegration(tenantId);

    if (!hasIntegration) {
      console.warn(`[ToolExecutor] Integración no configurada para ${toolName}`);
      return {
        id,
        toolName,
        result: {
          success: false,
          error: `La herramienta "${toolName}" requiere configuración adicional. Contacta al administrador.`
        }
      };
    }

    // 5. Ejecutar el tool
    try {
      const startTime = Date.now();

      const result = await tool.execute({
        tenantId,
        leadId,
        parameters
      });

      const executionTime = Date.now() - startTime;

      console.log(`[ToolExecutor] Tool ${toolName} ejecutado en ${executionTime}ms`);

      // 6. Incrementar contador de uso
      await AIRateLimiter.incrementUsage(tenantId, leadId, 'tool_call');

      // 7. Log de ejecución (opcional, lo hace el tool también)
      if (result.success) {
        console.log(`[ToolExecutor] ✅ ${toolName} exitoso:`, result.message || '');
      } else {
        console.warn(`[ToolExecutor] ⚠️ ${toolName} falló:`, result.error || '');
      }

      return {
        id,
        toolName,
        result
      };
    } catch (error) {
      console.error(`[ToolExecutor] Error ejecutando ${toolName}:`, error);

      return {
        id,
        toolName,
        result: {
          success: false,
          error: error.message || 'Error interno ejecutando la herramienta',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      };
    }
  }

  /**
   * Ejecuta tools en paralelo (útil para operaciones independientes)
   * @param {Object} params - Parámetros
   * @returns {Promise<Array>} Resultados
   */
  static async executeParallel({ tenantId, leadId, toolCalls }) {
    console.log(`[ToolExecutor] Ejecutando ${toolCalls.length} tools en paralelo`);

    const promises = toolCalls.map(call =>
      this.executeSingle({ tenantId, leadId, toolCall: call })
    );

    return await Promise.all(promises);
  }
}
