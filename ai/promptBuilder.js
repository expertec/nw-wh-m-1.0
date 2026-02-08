/**
 * Constructor de system prompts para el agente IA
 * Combina personalidad del tenant, contexto del negocio y herramientas disponibles
 */
export const promptBuilder = {
  /**
   * Construye el system prompt completo para el agente IA
   * @param {Object} params - Parámetros
   * @param {Object} params.personality - Configuración de personalidad del agente
   * @param {Object} params.businessContext - Contexto del negocio
   * @param {Array} params.availableTools - Tools disponibles para este tenant
   * @param {Object} params.leadData - Datos del lead (opcional)
   * @returns {string} System prompt completo
   */
  build({ personality, businessContext, availableTools = [], leadData = {} }) {
    const sections = [];

    // 1. Instrucciones base
    sections.push(this._getBaseInstructions());

    // 2. Personalidad y rol
    if (personality?.systemPrompt) {
      sections.push(`# Tu Rol\n${personality.systemPrompt}`);
    }

    if (personality?.tone) {
      sections.push(`# Tono de Comunicación\nUsas un tono ${personality.tone}.`);
    }

    // 3. Contexto del negocio
    if (businessContext) {
      sections.push(this._buildBusinessContext(businessContext));
    }

    // 4. Información del lead
    if (leadData.nombre || leadData.telefono) {
      sections.push(this._buildLeadContext(leadData));
    }

    // 5. Herramientas disponibles
    if (availableTools.length > 0) {
      sections.push(this._buildToolsInstructions(availableTools));
    }

    // 6. Instrucciones finales
    sections.push(this._getFinalInstructions());

    return sections.filter(Boolean).join('\n\n');
  },

  /**
   * Instrucciones base del agente
   */
  _getBaseInstructions() {
    return `Eres un asistente virtual inteligente que ayuda a los clientes a través de WhatsApp.

**Reglas importantes:**
- Responde SIEMPRE en español (idioma del usuario).
- Sé conciso: mantén las respuestas breves y directas (máximo 2-3 líneas).
- Sé proactivo: ofrece ayuda relevante sin que te la pidan.
- Sé humano: usa un lenguaje natural, evita sonar como un robot.
- NO uses emojis a menos que el usuario los use primero.
- NO inventes información que no tengas.`;
  },

  /**
   * Construye sección de contexto del negocio
   */
  _buildBusinessContext(context) {
    const parts = [];

    if (context.companyName) {
      parts.push(`**Empresa:** ${context.companyName}`);
    }

    if (context.services && context.services.length > 0) {
      parts.push(`**Servicios:** ${context.services.join(', ')}`);
    }

    if (context.schedule) {
      parts.push(`**Horario:** ${context.schedule}`);
    }

    if (context.description) {
      parts.push(`**Descripción:** ${context.description}`);
    }

    if (parts.length === 0) return '';

    return `# Información del Negocio\n${parts.join('\n')}`;
  },

  /**
   * Construye sección de contexto del lead
   */
  _buildLeadContext(leadData) {
    const parts = [];

    if (leadData.nombre) {
      parts.push(`**Nombre del cliente:** ${leadData.nombre}`);
      parts.push(`Dirígete al cliente por su nombre (${leadData.nombre}) para personalizar la conversación.`);
    }

    if (leadData.estado) {
      parts.push(`**Estado del cliente:** ${leadData.estado}`);
    }

    if (leadData.etiquetas && leadData.etiquetas.length > 0) {
      parts.push(`**Etiquetas:** ${leadData.etiquetas.join(', ')}`);
    }

    if (parts.length === 0) return '';

    return `# Información del Cliente\n${parts.join('\n')}`;
  },

  /**
   * Construye sección de instrucciones para tools
   */
  _buildToolsInstructions(tools) {
    return `# Herramientas Disponibles

Tienes acceso a las siguientes herramientas que puedes usar para ayudar al cliente:

${tools.map(tool => `- **${tool.name}**: ${tool.description}`).join('\n')}

**Cuándo usar herramientas:**
- Usa las herramientas SOLO cuando el cliente lo solicite o cuando sea claramente necesario.
- Antes de usar una herramienta, asegúrate de tener toda la información requerida.
- Si falta información, pregunta al cliente primero.
- Después de usar una herramienta, explica al cliente qué hiciste.`;
  },

  /**
   * Instrucciones finales
   */
  _getFinalInstructions() {
    return `# Instrucciones Finales

**Formato de respuestas:**
- Usa párrafos cortos (1-2 líneas máximo)
- Usa saltos de línea para separar ideas
- NO uses formato markdown (**negrita**, *cursiva*) en las respuestas a clientes
- Sé directo y claro

**Manejo de errores:**
- Si no entiendes algo, pide aclaración educadamente
- Si no puedes ayudar con algo, reconócelo honestamente
- Si una herramienta falla, informa al cliente de forma sencilla

**Privacidad:**
- NUNCA compartas información de otros clientes
- NO pidas información sensible (contraseñas, datos bancarios)`;
  }
};
