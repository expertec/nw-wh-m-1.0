import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { contextManager } from './contextManager.js';
import { promptBuilder } from './promptBuilder.js';
import { getAgentConfig, leadsCol } from '../tenantContext.js';
import { AIRateLimiter } from '../utils/rateLimiter.js';
import { toolRegistry } from '../tools/toolRegistry.js';
import { ToolExecutor } from '../tools/base/ToolExecutor.js';
import { sendMessageToLead } from '../whatsappService.js';

// Importar tools para que se auto-registren
import '../tools/echo/EchoTool.js';
import '../tools/google-calendar/CalendarTool.js';
import '../tools/sequences/SequenceTool.js';
import '../tools/leads/LeadTool.js';

/**
 * Servicio principal del agente IA
 * Orquesta el procesamiento de mensajes con OpenAI
 */
export const aiAgentService = {
  /**
   * Procesa un mensaje entrante con el agente IA
   * @param {Object} params - Parámetros
   * @param {string} params.tenantId - ID del tenant
   * @param {string} params.leadId - ID del lead
   * @param {string} params.message - Mensaje del usuario
   * @param {Object} params.leadData - Datos del lead
   * @returns {Object} { shouldHandleWithAI: boolean, response: string }
   */
  async processMessage({ tenantId, leadId, message, leadData }) {
    try {
      console.log(`[AI] Procesando mensaje para lead ${leadId}`);

      // 1. Verificar rate limits
      await AIRateLimiter.checkLimit(tenantId, leadId, 'message');

      // 2. Obtener configuración del agente
      const agentConfig = await getAgentConfig(tenantId);
      if (!agentConfig || !agentConfig.enabled) {
        console.log('[AI] Agente IA no habilitado para este tenant');
        return { shouldHandleWithAI: false };
      }

      // 3. Cargar contexto conversacional
      const context = await contextManager.getContext(tenantId, leadId);

      // 4. Obtener datos completos del lead desde Firestore
      const fullLeadData = await this._getFullLeadData(tenantId, leadId, leadData);

      // 5. Obtener tools habilitados para este tenant
      const availableTools = await toolRegistry.getEnabledTools(tenantId);
      console.log(`[AI] Tools disponibles: ${availableTools.map(t => t.name).join(', ') || 'ninguno'}`);

      // 6. Construir system prompt
      const systemPrompt = promptBuilder.build({
        personality: agentConfig.personality || {},
        businessContext: agentConfig.businessContext || {},
        availableTools,
        leadData: fullLeadData
      });

      // 7. Formatear tools para OpenAI
      const openaiProvider = new OpenAIProvider(process.env.OPENAI_API_KEY);
      const formattedTools = openaiProvider.formatToolsForOpenAI(availableTools);

      // 8. Llamar a OpenAI
      const response = await openaiProvider.sendMessage({
        systemPrompt,
        conversationHistory: context.history,
        userMessage: message,
        model: agentConfig.model || 'gpt-4o',
        maxTokens: agentConfig.maxTokens || 500,
        tools: formattedTools
      });

      console.log(`[AI] Respuesta de OpenAI: ${response.text.substring(0, 50)}...`);
      console.log(`[AI] Tokens usados: ${response.usage.total_tokens}`);

      // 9. ¿OpenAI quiere ejecutar tools?
      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log(`[AI] OpenAI solicitó ${response.toolCalls.length} tool calls`);

        // 9a. Ejecutar todos los tools
        const toolResults = await ToolExecutor.executeAll({
          tenantId,
          leadId,
          toolCalls: response.toolCalls
        });

        console.log('[AI] Tools ejecutados, obteniendo respuesta final de OpenAI');

        // 9b. Construir historial con el mensaje original y los tool calls
        const historyWithToolCall = [
          ...context.history,
          { role: 'user', content: message },
          {
            role: 'assistant',
            content: response.text || null,
            tool_calls: response.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.toolName,
                arguments: JSON.stringify(tc.parameters)
              }
            }))
          }
        ];

        // 9c. Enviar resultados de tools de vuelta a OpenAI para respuesta final
        const finalResponse = await openaiProvider.sendToolResults({
          toolResults,
          conversationHistory: historyWithToolCall,
          model: agentConfig.model || 'gpt-4o'
        });

        console.log(`[AI] Respuesta final: ${finalResponse.text.substring(0, 50)}...`);

        // 9d. Enviar respuesta final por WhatsApp
        await sendMessageToLead(tenantId, leadData.jid || leadData.telefono, finalResponse.text);

        // 9e. Guardar en contexto conversacional
        await contextManager.addInteraction(tenantId, leadId, {
          userMessage: message,
          aiResponse: finalResponse.text,
          toolsUsed: toolResults.map(t => t.toolName),
          tokensUsed: response.usage.total_tokens + finalResponse.usage.total_tokens
        });

        // 9f. Incrementar uso en rate limiter
        await AIRateLimiter.incrementUsage(tenantId, leadId, 'message', {
          tokens: response.usage.total_tokens + finalResponse.usage.total_tokens
        });

        return {
          shouldHandleWithAI: true,
          response: finalResponse.text
        };
      }

      // 10. Sin tools: respuesta directa
      console.log('[AI] Respuesta directa sin tools');

      // Enviar respuesta por WhatsApp
      await sendMessageToLead(tenantId, leadData.jid || leadData.telefono, response.text);

      // 11. Guardar en contexto conversacional
      await contextManager.addInteraction(tenantId, leadId, {
        userMessage: message,
        aiResponse: response.text,
        toolsUsed: [],
        tokensUsed: response.usage.total_tokens
      });

      // 12. Incrementar uso en rate limiter
      await AIRateLimiter.incrementUsage(tenantId, leadId, 'message', {
        tokens: response.usage.total_tokens
      });

      return {
        shouldHandleWithAI: true,
        response: response.text
      };

    } catch (error) {
      console.error('[AI] Error procesando mensaje:', error);

      // Fallback según configuración
      const agentConfig = await getAgentConfig(tenantId);
      if (agentConfig?.fallbackBehavior?.onError === 'trigger') {
        console.log('[AI] Fallback a secuencia estática por error');
        return { shouldHandleWithAI: false };
      }

      // Si no hay fallback configurado, intentar responder con error genérico
      if (agentConfig?.fallbackBehavior?.onError === 'notify-admin') {
        // TODO: Implementar notificación a admin
        console.error('[AI] Notificación a admin requerida (no implementado)');
      }

      return { shouldHandleWithAI: false };
    }
  },

  /**
   * Obtiene datos completos del lead desde Firestore
   * @private
   */
  async _getFullLeadData(tenantId, leadId, baseData) {
    try {
      const leadDoc = await leadsCol(tenantId).doc(leadId).get();

      if (!leadDoc.exists) {
        return baseData;
      }

      const leadFirestore = leadDoc.data();

      return {
        nombre: leadFirestore.nombre || baseData.nombre || '',
        telefono: leadFirestore.telefono || baseData.telefono || '',
        estado: leadFirestore.estado || 'nuevo',
        etiquetas: leadFirestore.etiquetas || [],
        fecha_creacion: leadFirestore.fecha_creacion,
        jid: leadFirestore.jid || baseData.jid
      };
    } catch (error) {
      console.error('[AI] Error obteniendo datos del lead:', error);
      return baseData;
    }
  },

  /**
   * Procesa un mensaje de prueba (para testing desde API)
   * @param {Object} params - Parámetros
   * @returns {Object} Respuesta del agente
   */
  async testMessage({ tenantId, message, leadData = {} }) {
    const testLeadId = `test_${Date.now()}`;

    return await this.processMessage({
      tenantId,
      leadId: testLeadId,
      message,
      leadData: {
        nombre: leadData.nombre || 'Usuario de Prueba',
        telefono: '1234567890',
        ...leadData
      }
    });
  }
};
