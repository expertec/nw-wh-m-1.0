/**
 * Interfaz base para todos los tools del agente IA
 * Cada tool debe heredar de esta clase e implementar los métodos abstractos
 */
export class ToolInterface {
  /**
   * Ejecuta el tool con los parámetros dados
   * @param {Object} params - Parámetros de ejecución
   * @param {string} params.tenantId - ID del tenant
   * @param {string} params.leadId - ID del lead
   * @param {Object} params.parameters - Parámetros específicos del tool
   * @returns {Promise<Object>} Resultado de la ejecución
   *
   * El resultado debe tener el formato:
   * {
   *   success: boolean,
   *   message?: string,  // Mensaje para el usuario
   *   data?: any,        // Datos adicionales
   *   error?: string     // Error si success = false
   * }
   */
  async execute({ tenantId, leadId, parameters }) {
    throw new Error('Method execute() must be implemented by subclass');
  }

  /**
   * Verifica si el tenant tiene la integración necesaria configurada
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<boolean>} true si está configurado
   */
  async verifyIntegration(tenantId) {
    // Por defecto, no requiere integración
    // Los tools que necesiten integración (ej: Google Calendar) deben sobrescribir
    return true;
  }

  /**
   * Retorna la definición del tool en formato OpenAI function calling
   * Esta definición se envía a GPT-4o para que sepa cuándo y cómo usar el tool
   *
   * @returns {Object} Definición en formato:
   * {
   *   name: string,                    // Nombre único del tool
   *   description: string,             // Descripción clara de qué hace
   *   parameters: {                    // Parámetros en JSON Schema
   *     type: 'object',
   *     properties: {
   *       param1: { type: 'string', description: '...' },
   *       param2: { type: 'number', description: '...' }
   *     },
   *     required: ['param1']
   *   }
   * }
   */
  getToolDefinition() {
    throw new Error('Method getToolDefinition() must be implemented by subclass');
  }

  /**
   * Retorna el nombre del tool (para logging y registro)
   * @returns {string}
   */
  getName() {
    const definition = this.getToolDefinition();
    return definition.name;
  }

  /**
   * Valida que los parámetros recibidos cumplan con el schema
   * @param {Object} parameters - Parámetros a validar
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateParameters(parameters) {
    const definition = this.getToolDefinition();
    const schema = definition.parameters;

    if (!schema || !schema.properties) {
      return { valid: true, errors: [] };
    }

    const errors = [];
    const required = schema.required || [];

    // Verificar campos requeridos
    for (const field of required) {
      if (!(field in parameters)) {
        errors.push(`Campo requerido faltante: ${field}`);
      }
    }

    // Validar tipos básicos (string, number, boolean)
    for (const [key, value] of Object.entries(parameters)) {
      const propSchema = schema.properties[key];
      if (!propSchema) continue;

      const type = propSchema.type;
      const actualType = typeof value;

      if (type === 'string' && actualType !== 'string') {
        errors.push(`${key} debe ser string, recibido: ${actualType}`);
      } else if (type === 'number' && actualType !== 'number') {
        errors.push(`${key} debe ser number, recibido: ${actualType}`);
      } else if (type === 'boolean' && actualType !== 'boolean') {
        errors.push(`${key} debe ser boolean, recibido: ${actualType}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Registra la ejecución del tool en logs
   * @param {string} tenantId - ID del tenant
   * @param {string} leadId - ID del lead
   * @param {Object} execution - Datos de la ejecución
   * @protected
   */
  async logToolExecution(tenantId, leadId, execution) {
    try {
      const { aiContextCol } = await import('../../tenantContext.js');
      const { now } = await import('../../firebaseAdmin.js');

      await aiContextCol(tenantId, leadId).add({
        type: 'tool_execution',
        toolName: this.getName(),
        timestamp: now(),
        ...execution
      });
    } catch (error) {
      console.error('[ToolInterface] Error logging execution:', error);
    }
  }
}
