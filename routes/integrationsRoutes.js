import express from 'express';
import { GoogleCalendarOAuth } from '../tools/google-calendar/oauthHandler.js';
import { CalendarClient } from '../tools/google-calendar/calendarClient.js';
import { getTenantId } from '../authMiddleware.js';
import { requireRole } from '../authMiddleware.js';

const router = express.Router();

// ============== GOOGLE CALENDAR ==============

/**
 * GET /api/integrations/google-calendar/auth-url
 * Obtiene la URL de autorización OAuth de Google
 * El admin debe abrir esta URL en el navegador para autorizar
 */
router.get('/google-calendar/auth-url', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    // La URL de redirect debe coincidir con la configurada en Google Cloud Console
    const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
      `${req.protocol}://${req.get('host')}/api/integrations/google-calendar/callback`;

    const authUrl = await GoogleCalendarOAuth.getAuthUrl(tenantId, redirectUri);

    return res.json({
      success: true,
      authUrl,
      instructions: 'Abre esta URL en tu navegador para autorizar el acceso a Google Calendar'
    });
  } catch (error) {
    console.error('[API] Error generando URL de autorización:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET/POST /api/integrations/google-calendar/callback
 * Callback de OAuth - procesa el código de autorización
 * GET: Google redirige aquí después del consent screen
 * POST: El frontend puede enviar el código manualmente
 */
async function handleGoogleCallback(req, res) {
  try {
    // GET: código viene en query params; POST: viene en body
    const code = req.query.code || req.body?.code;
    const state = req.query.state || req.body?.state;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Código de autorización no proporcionado'
      });
    }

    // El state contiene el tenantId
    const tenantId = state;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'State (tenantId) no proporcionado'
      });
    }

    const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
      `${req.protocol}://${req.get('host')}/api/integrations/google-calendar/callback`;

    const result = await GoogleCalendarOAuth.handleCallback(code, tenantId, redirectUri);

    // Si es GET (redirect de Google), mostrar página de éxito
    if (req.method === 'GET') {
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:50px">
          <h2>Google Calendar conectado exitosamente</h2>
          <p>Cuenta: ${result.email}</p>
          <p>Puedes cerrar esta ventana y volver a la aplicación.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'google-calendar-connected', email: '${result.email}' }, '*');
              setTimeout(() => window.close(), 3000);
            }
          </script>
        </body></html>
      `);
    }

    return res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[API] Error en callback de Google Calendar:', error);

    if (req.method === 'GET') {
      return res.send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:50px">
          <h2>Error al conectar Google Calendar</h2>
          <p>${error.message}</p>
          <p>Puedes cerrar esta ventana e intentar de nuevo.</p>
        </body></html>
      `);
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

router.get('/google-calendar/callback', handleGoogleCallback);
router.post('/google-calendar/callback', handleGoogleCallback);

/**
 * GET /api/integrations/google-calendar/status
 * Obtiene el estado de la conexión de Google Calendar
 */
router.get('/google-calendar/status', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const status = await GoogleCalendarOAuth.getConnectionStatus(tenantId);

    return res.json({
      success: true,
      tenantId,
      ...status
    });
  } catch (error) {
    console.error('[API] Error obteniendo estado de Google Calendar:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/integrations/google-calendar/refresh
 * Refresca manualmente el access token
 */
router.post('/google-calendar/refresh', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    await GoogleCalendarOAuth.refreshAccessToken(tenantId);

    return res.json({
      success: true,
      message: 'Access token refrescado exitosamente'
    });
  } catch (error) {
    console.error('[API] Error refrescando access token:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/integrations/google-calendar
 * Desconecta Google Calendar
 */
router.delete('/google-calendar', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    await GoogleCalendarOAuth.disconnect(tenantId);

    return res.json({
      success: true,
      message: 'Google Calendar desconectado exitosamente'
    });
  } catch (error) {
    console.error('[API] Error desconectando Google Calendar:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/integrations/google-calendar/calendars
 * Lista todos los calendarios disponibles del usuario
 */
router.get('/google-calendar/calendars', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    // Obtener credenciales
    const { tenantDoc } = await import('../tenantContext.js');
    const doc = await tenantDoc(tenantId)
      .collection('integrations')
      .doc('google-calendar')
      .get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Google Calendar no está conectado'
      });
    }

    const credentials = doc.data();

    // Obtener access token válido
    const accessToken = await GoogleCalendarOAuth.getValidAccessToken(
      tenantId,
      credentials
    );

    // Listar calendarios
    const calendarClient = new CalendarClient(accessToken);
    const calendars = await calendarClient.listCalendars();

    return res.json({
      success: true,
      calendars: calendars.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description,
        primary: cal.primary || false,
        timeZone: cal.timeZone
      }))
    });
  } catch (error) {
    console.error('[API] Error listando calendarios:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/integrations/google-calendar/events
 * Lista eventos del calendario
 */
router.get('/google-calendar/events', requireRole(['admin', 'superadmin']), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { timeMin, timeMax, maxResults } = req.query;

    // Obtener credenciales
    const { tenantDoc } = await import('../tenantContext.js');
    const doc = await tenantDoc(tenantId)
      .collection('integrations')
      .doc('google-calendar')
      .get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Google Calendar no está conectado'
      });
    }

    const credentials = doc.data();

    // Obtener access token válido
    const accessToken = await GoogleCalendarOAuth.getValidAccessToken(
      tenantId,
      credentials
    );

    // Listar eventos
    const calendarClient = new CalendarClient(accessToken);
    const events = await calendarClient.listEvents({
      timeMin: timeMin ? new Date(timeMin) : new Date(),
      timeMax: timeMax ? new Date(timeMax) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      maxResults: parseInt(maxResults) || 10
    }, credentials.calendarId || 'primary');

    return res.json({
      success: true,
      events: events.map(event => ({
        id: event.id,
        title: event.summary,
        description: event.description,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        link: event.htmlLink,
        meetLink: event.hangoutLink
      }))
    });
  } catch (error) {
    console.error('[API] Error listando eventos:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
