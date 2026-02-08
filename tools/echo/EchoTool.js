import { ToolInterface } from '../base/ToolInterface.js';

/**
 * EchoTool - Tool de prueba
 * Simplemente devuelve el texto que se le pasa, útil para testing
 */
export class EchoTool extends ToolInterface {
  /**
   * Ejecuta el echo: devuelve el mismo texto recibido
   */
  async execute({ tenantId, leadId, parameters }) {
    const { text, repeat = 1 } = parameters;

    console.log(`[EchoTool] Echo para lead ${leadId}: "${text}" x${repeat}`);

    // Simular procesamiento (útil para testing de latencia)
    await this._delay(100);

    // Repetir el texto si se solicita
    const result = Array(repeat).fill(text).join(' ');

    // Log de ejecución
    await this.logToolExecution(tenantId, leadId, {
      action: 'echo',
      input: text,
      repeat,
      success: true
    });

    return {
      success: true,
      message: `Echo: ${result}`,
      data: {
        originalText: text,
        repeated: repeat,
        result
      }
    };
  }

  /**
   * No requiere integración (es un tool de prueba)
   */
  async verifyIntegration(tenantId) {
    return true;
  }

  /**
   * Definición del tool para OpenAI
   */
  getToolDefinition() {
    return {
      name: 'echo',
      description: 'Herramienta de prueba que devuelve el mismo texto que recibe. Útil para testing.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Texto a repetir'
          },
          repeat: {
            type: 'number',
            description: 'Número de veces a repetir el texto (default: 1)'
          }
        },
        required: ['text']
      }
    };
  }

  /**
   * Helper para simular delay
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Auto-registrar el tool cuando se importe
import { toolRegistry } from '../toolRegistry.js';
toolRegistry.register(new EchoTool());
