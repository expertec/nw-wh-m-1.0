import express from 'express';
import { configCol } from '../tenantContext.js';
import { getTenantId } from '../authMiddleware.js';
import { requireRole } from '../authMiddleware.js';
import { aiAgentService } from '../ai/aiAgentService.js';
import { AIRateLimiter } from '../utils/rateLimiter.js';
import { contextManager } from '../ai/contextManager.js';

const router = express.Router();

/**
 * GET /api/ai-agent/config
 * Obtiene la configuración del agente IA para el tenant actual
 */
router.get('/config', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const doc = await configCol(tenantId).doc('aiAgent').get();

    const defaultConfig = {
      enabled: false,
      provider: 'openai',
      model: 'gpt-4o',
      personality: {
        systemPrompt: 'Eres un asistente virtual de atención al cliente.',
        tone: 'profesional',
        language: 'es'
      },
      businessContext: {
        companyName: '',
        services: [],
        schedule: ''
      },
      enabledTools: [],
      rateLimits: {
        maxMessagesPerLeadPerDay: 50,
        maxToolCallsPerDay: 100
      },
      fallbackBehavior: {
        onError: 'trigger',
        defaultTrigger: 'NuevoLeadWeb'
      }
    };

    const config = doc.exists ? { ...defaultConfig, ...doc.data() } : defaultConfig;

    return res.json({
      success: true,
      tenantId,
      config
    });
  } catch (error) {
    console.error('[API] Error obteniendo config de agente IA:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/ai-agent/config
 * Actualiza la configuración del agente IA
 * Requiere rol admin o superadmin
 */
router.patch('/config', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Se requiere objeto "config" en el body'
      });
    }

    // Validaciones básicas
    if (config.model && !['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'].includes(config.model)) {
      return res.status(400).json({
        success: false,
        error: 'Modelo inválido. Opciones: gpt-4o, gpt-4-turbo, gpt-3.5-turbo'
      });
    }

    // Guardar configuración (merge con existente)
    await configCol(tenantId).doc('aiAgent').set(config, { merge: true });

    console.log(`[API] Configuración de agente IA actualizada para tenant ${tenantId}`);

    return res.json({
      success: true,
      tenantId,
      message: 'Configuración actualizada exitosamente'
    });
  } catch (error) {
    console.error('[API] Error actualizando config de agente IA:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ai-agent/test
 * Envía un mensaje de prueba al agente IA
 * Útil para probar configuración sin enviar WhatsApp real
 */
router.post('/test', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { message, leadData } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere campo "message"'
      });
    }

    console.log(`[API] Testing agente IA para tenant ${tenantId}`);

    const result = await aiAgentService.testMessage({
      tenantId,
      message,
      leadData: leadData || {}
    });

    return res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('[API] Error en test de agente IA:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ai-agent/stats
 * Obtiene estadísticas de uso del agente IA
 */
router.get('/stats', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { date } = req.query; // Opcional: YYYY-MM-DD

    const stats = await AIRateLimiter.getUsageStats(tenantId, date);

    return res.json({
      success: true,
      tenantId,
      stats
    });
  } catch (error) {
    console.error('[API] Error obteniendo stats de agente IA:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/leads/:leadId/ai-context
 * Obtiene el contexto conversacional de un lead
 */
router.get('/leads/:leadId/ai-context', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { leadId } = req.params;

    const context = await contextManager.getContext(tenantId, leadId);
    const stats = await contextManager.getStats(tenantId, leadId);

    return res.json({
      success: true,
      leadId,
      context: {
        history: context.history,
        metadata: stats
      }
    });
  } catch (error) {
    console.error('[API] Error obteniendo contexto de lead:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/leads/:leadId/ai-context
 * Limpia el contexto conversacional de un lead
 */
router.delete('/leads/:leadId/ai-context', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { leadId } = req.params;

    await contextManager.clearContext(tenantId, leadId);

    return res.json({
      success: true,
      leadId,
      message: 'Contexto limpiado exitosamente'
    });
  } catch (error) {
    console.error('[API] Error limpiando contexto de lead:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
