import OpenAI from 'openai';

/**
 * Provider para OpenAI (ChatGPT)
 * Maneja llamadas a la API de OpenAI con soporte para tool calling (function calling)
 */
export class OpenAIProvider {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key es requerida');
    }
    this.client = new OpenAI({ apiKey });
  }

  /**
   * Envía un mensaje a OpenAI y recibe respuesta
   * @param {Object} params - Parámetros
   * @param {string} params.systemPrompt - System prompt del agente
   * @param {Array} params.conversationHistory - Historial de mensajes [{ role, content }]
   * @param {string} params.userMessage - Mensaje del usuario
   * @param {string} params.model - Modelo a usar (default: gpt-4o)
   * @param {number} params.maxTokens - Tokens máximos (default: 500)
   * @param {Array} params.tools - Tools disponibles en formato OpenAI
   * @returns {Object} Respuesta con text, toolCalls, usage
   */
  async sendMessage({
    systemPrompt,
    conversationHistory = [],
    userMessage,
    model = 'gpt-4o',
    maxTokens = 500,
    tools = []
  }) {
    try {
      // Construir mensajes en formato OpenAI
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      // Parámetros base
      const params = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7
      };

      // Agregar tools si están disponibles
      if (tools && tools.length > 0) {
        params.tools = tools;
        params.tool_choice = 'auto'; // Dejar que el modelo decida
      }

      const response = await this.client.chat.completions.create(params);

      const choice = response.choices[0];
      const message = choice.message;

      // Parsear respuesta
      const result = {
        text: message.content || '',
        toolCalls: [],
        usage: {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens
        },
        finishReason: choice.finish_reason
      };

      // Si hay tool calls, parsearlos
      if (message.tool_calls && message.tool_calls.length > 0) {
        result.toolCalls = message.tool_calls.map(tc => ({
          id: tc.id,
          toolName: tc.function.name,
          parameters: JSON.parse(tc.function.arguments)
        }));
      }

      return result;
    } catch (error) {
      console.error('[OpenAI] Error en sendMessage:', error.message);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  /**
   * Envía resultados de tool execution de vuelta a OpenAI para obtener respuesta final
   * @param {Object} params - Parámetros
   * @param {Array} params.toolResults - Resultados de tools ejecutados
   * @param {Array} params.conversationHistory - Historial de la conversación
   * @param {string} params.model - Modelo a usar
   * @returns {Object} Respuesta final con texto
   */
  async sendToolResults({
    toolResults,
    conversationHistory,
    model = 'gpt-4o'
  }) {
    try {
      // Convertir toolResults a formato OpenAI
      const toolMessages = toolResults.map(tr => ({
        role: 'tool',
        tool_call_id: tr.id,
        name: tr.toolName,
        content: JSON.stringify(tr.result)
      }));

      const messages = [
        ...conversationHistory,
        ...toolMessages
      ];

      const response = await this.client.chat.completions.create({
        model,
        messages,
        max_tokens: 500,
        temperature: 0.7
      });

      const choice = response.choices[0];
      const message = choice.message;

      return {
        text: message.content || '',
        usage: {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens
        }
      };
    } catch (error) {
      console.error('[OpenAI] Error en sendToolResults:', error.message);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  /**
   * Formatea tools del registry al formato esperado por OpenAI
   * OpenAI usa el formato "function calling" (tools array)
   * @param {Array} toolDefinitions - Array de definiciones de tools
   * @returns {Array} Tools en formato OpenAI
   */
  formatToolsForOpenAI(toolDefinitions) {
    if (!toolDefinitions || toolDefinitions.length === 0) {
      return [];
    }

    return toolDefinitions.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters || {},
          required: tool.required || []
        }
      }
    }));
  }
}
