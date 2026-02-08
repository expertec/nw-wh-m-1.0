import { ToolInterface } from '../base/ToolInterface.js';
import { GoogleCalendarOAuth } from './oauthHandler.js';
import { CalendarClient } from './calendarClient.js';
import { configCol } from '../../tenantContext.js';

/**
 * Tool para agendar citas en Google Calendar
 * El agente IA puede usar este tool cuando un usuario solicite agendar una cita
 */
export class CalendarTool extends ToolInterface {
  /**
   * Ejecuta la creación de un evento en Google Calendar
   */
  async execute({ tenantId, leadId, parameters }) {
    try {
      console.log(`[CalendarTool] Creando evento para lead ${leadId}:`, parameters);

      // 1. Validar parámetros requeridos
      if (!parameters.title || !parameters.startDateTime || !parameters.endDateTime) {
        return {
          success: false,
          error: 'Faltan parámetros requeridos: title, startDateTime, endDateTime'
        };
      }

      // 2. Obtener credenciales de Google Calendar
      const credentials = await this.getCredentials(tenantId);
      if (!credentials || !credentials.enabled) {
        return {
          success: false,
          error: 'Google Calendar no está conectado. Por favor, contacta al administrador para configurarlo.'
        };
      }

      // 3. Obtener access token válido (refresca si expiró)
      const accessToken = await GoogleCalendarOAuth.getValidAccessToken(
        tenantId,
        credentials
      );

      // 4. Crear cliente de Calendar API
      const calendarClient = new CalendarClient(accessToken);

      // 5. Preparar datos del evento
      const eventData = {
        summary: parameters.title,
        description: parameters.description || 'Cita agendada vía WhatsApp',
        start: {
          dateTime: parameters.startDateTime,
          timeZone: parameters.timeZone || 'America/Mexico_City'
        },
        end: {
          dateTime: parameters.endDateTime,
          timeZone: parameters.timeZone || 'America/Mexico_City'
        },
        attendees: []
      };

      // Agregar email del cliente si se proporciona
      if (parameters.guestEmail) {
        eventData.attendees.push({ email: parameters.guestEmail });
      }

      // Agregar Google Meet si se solicita
      if (parameters.includeMeet !== false) {
        eventData.conferenceData = {
          createRequest: {
            requestId: `${leadId}-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        };
      }

      // 6. Crear evento en Google Calendar
      const event = await calendarClient.createEvent(
        eventData,
        credentials.calendarId || 'primary'
      );

      console.log(`[CalendarTool] Evento creado exitosamente: ${event.id}`);

      // 7. Guardar registro de ejecución
      await this.logToolExecution(tenantId, leadId, {
        action: 'create_event',
        eventId: event.id,
        eventLink: event.htmlLink,
        success: true
      });

      // 8. Retornar resultado exitoso
      return {
        success: true,
        message: `✅ Cita agendada exitosamente`,
        data: {
          eventId: event.id,
          eventLink: event.htmlLink,
          meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
          startTime: event.start.dateTime,
          endTime: event.end.dateTime,
          title: event.summary
        }
      };

    } catch (error) {
      console.error('[CalendarTool] Error creando evento:', error);

      // Si es error de autenticación (401), intentar refrescar token
      if (error.code === 401 || error.message.includes('invalid_grant')) {
        try {
          console.log('[CalendarTool] Intentando refrescar token...');
          await GoogleCalendarOAuth.refreshAccessToken(tenantId);

          // Reintentar una vez
          console.log('[CalendarTool] Reintentando crear evento...');
          return await this.execute({ tenantId, leadId, parameters });
        } catch (refreshError) {
          console.error('[CalendarTool] Error refrescando token:', refreshError);
          return {
            success: false,
            error: 'La conexión con Google Calendar expiró. Por favor, reconecta tu cuenta en la configuración.'
          };
        }
      }

      // Otros errores
      return {
        success: false,
        error: 'No pude agendar la cita en este momento. Por favor, intenta más tarde o contacta al administrador.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      };
    }
  }

  /**
   * Verifica si el tenant tiene Google Calendar configurado
   */
  async verifyIntegration(tenantId) {
    try {
      const credentials = await this.getCredentials(tenantId);
      return credentials && credentials.enabled === true;
    } catch (error) {
      console.error('[CalendarTool] Error verificando integración:', error);
      return false;
    }
  }

  /**
   * Obtiene las credenciales de Google Calendar del tenant
   * @private
   */
  async getCredentials(tenantId) {
    try {
      const doc = await configCol(tenantId)
        .collection('integrations')
        .doc('google-calendar')
        .get();

      return doc.exists ? doc.data() : null;
    } catch (error) {
      console.error('[CalendarTool] Error obteniendo credenciales:', error);
      return null;
    }
  }

  /**
   * Define el tool para OpenAI function calling
   */
  getToolDefinition() {
    return {
      name: 'create_calendar_event',
      description: 'Agenda una cita o reunión en Google Calendar. Usa esta herramienta cuando el usuario solicite agendar, programar o reservar una cita, reunión o visita.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Título descriptivo de la cita (ej: "Visita al departamento", "Reunión con cliente")'
          },
          description: {
            type: 'string',
            description: 'Descripción detallada de la cita (opcional)'
          },
          startDateTime: {
            type: 'string',
            description: 'Fecha y hora de inicio en formato ISO 8601 (ej: "2024-02-15T14:00:00"). Asegúrate de usar la fecha y hora correcta según lo solicitado por el usuario.'
          },
          endDateTime: {
            type: 'string',
            description: 'Fecha y hora de fin en formato ISO 8601 (ej: "2024-02-15T15:00:00"). Por defecto, 1 hora después del inicio.'
          },
          guestEmail: {
            type: 'string',
            description: 'Email del invitado (opcional). Si el usuario no proporciona email, déjalo vacío.'
          },
          timeZone: {
            type: 'string',
            description: 'Zona horaria (ej: "America/Mexico_City"). Opcional, por defecto America/Mexico_City.'
          },
          includeMeet: {
            type: 'boolean',
            description: 'Si debe incluir enlace de Google Meet (default: true)'
          }
        },
        required: ['title', 'startDateTime', 'endDateTime']
      }
    };
  }
}

// Auto-registrar el tool cuando se importe
import { toolRegistry } from '../toolRegistry.js';
toolRegistry.register(new CalendarTool());
