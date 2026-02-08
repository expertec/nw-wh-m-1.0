import { getAgentConfig } from '../tenantContext.js';

/**
 * Registro centralizado de tools disponibles
 * Mantiene un mapa de todos los tools y permite registrar/obtener tools dinámicamente
 */
class ToolRegistry {
  constructor() {
    /**
     * Mapa de tools registrados: { toolName: ToolInstance }
     * @type {Map<string, ToolInterface>}
     */
    this.tools = new Map();
  }

  /**
   * Registra un nuevo tool en el registry
   * @param {ToolInterface} toolInstance - Instancia del tool
   */
  register(toolInstance) {
    const name = toolInstance.getName();

    if (this.tools.has(name)) {
      console.warn(`[ToolRegistry] Tool "${name}" ya estaba registrado, sobrescribiendo`);
    }

    this.tools.set(name, toolInstance);
    console.log(`[ToolRegistry] Tool registrado: ${name}`);
  }

  /**
   * Obtiene un tool por nombre
   * @param {string} toolName - Nombre del tool
   * @returns {ToolInterface|null} Instancia del tool o null
   */
  getTool(toolName) {
    return this.tools.get(toolName) || null;
  }

  /**
   * Obtiene todos los tools registrados
   * @returns {Array<ToolInterface>}
   */
  getAllTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Obtiene las definiciones de todos los tools en formato OpenAI
   * @returns {Array<Object>} Array de definiciones para OpenAI function calling
   */
  getAllDefinitions() {
    return this.getAllTools().map(tool => tool.getToolDefinition());
  }

  /**
   * Obtiene los tools habilitados para un tenant específico
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<Array<Object>>} Tools habilitados con sus definiciones
   */
  async getEnabledTools(tenantId) {
    try {
      const agentConfig = await getAgentConfig(tenantId);

      if (!agentConfig || !agentConfig.enabledTools) {
        // Si no hay configuración, no devolver tools
        return [];
      }

      const enabledToolNames = agentConfig.enabledTools;

      // Filtrar solo los tools que están en enabledTools
      const enabledTools = this.getAllTools().filter(tool =>
        enabledToolNames.includes(tool.getName())
      );

      // Retornar las definiciones
      return enabledTools.map(tool => tool.getToolDefinition());
    } catch (error) {
      console.error('[ToolRegistry] Error obteniendo tools habilitados:', error);
      return [];
    }
  }

  /**
   * Verifica si un tool está habilitado para un tenant
   * @param {string} toolName - Nombre del tool
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<boolean>}
   */
  async isToolEnabled(toolName, tenantId) {
    try {
      const agentConfig = await getAgentConfig(tenantId);

      if (!agentConfig || !agentConfig.enabledTools) {
        return false;
      }

      return agentConfig.enabledTools.includes(toolName);
    } catch (error) {
      console.error('[ToolRegistry] Error verificando tool habilitado:', error);
      return false;
    }
  }

  /**
   * Desregistra un tool
   * @param {string} toolName - Nombre del tool
   * @returns {boolean} true si se eliminó
   */
  unregister(toolName) {
    if (this.tools.has(toolName)) {
      this.tools.delete(toolName);
      console.log(`[ToolRegistry] Tool desregistrado: ${toolName}`);
      return true;
    }
    return false;
  }

  /**
   * Limpia todos los tools registrados
   */
  clear() {
    this.tools.clear();
    console.log('[ToolRegistry] Todos los tools limpiados');
  }

  /**
   * Obtiene información de todos los tools (para debugging)
   * @returns {Array<Object>}
   */
  getToolsInfo() {
    return this.getAllTools().map(tool => {
      const def = tool.getToolDefinition();
      return {
        name: def.name,
        description: def.description,
        parametersCount: Object.keys(def.parameters?.properties || {}).length,
        requiredParams: def.parameters?.required || []
      };
    });
  }
}

// Exportar instancia singleton
export const toolRegistry = new ToolRegistry();

// Auto-registrar tools disponibles
// (Los tools se registrarán cuando se importen)
