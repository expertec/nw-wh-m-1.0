import { google } from 'googleapis';

/**
 * Cliente wrapper para Google Calendar API
 * Simplifica las operaciones comunes del calendario
 */
export class CalendarClient {
  constructor(accessToken) {
    if (!accessToken) {
      throw new Error('Access token es requerido para CalendarClient');
    }

    // Crear cliente OAuth2 con solo el access token
    this.auth = new google.auth.OAuth2();
    this.auth.setCredentials({
      access_token: accessToken
    });

    // Inicializar cliente de Calendar API v3
    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  /**
   * Crea un evento en Google Calendar
   * @param {Object} eventData - Datos del evento
   * @param {string} eventData.summary - Título del evento
   * @param {string} eventData.description - Descripción
   * @param {Object} eventData.start - Inicio { dateTime, timeZone }
   * @param {Object} eventData.end - Fin { dateTime, timeZone }
   * @param {Array} eventData.attendees - Invitados [{ email }]
   * @param {Object} eventData.conferenceData - Configuración de Google Meet
   * @param {string} calendarId - ID del calendario (default: 'primary')
   * @returns {Promise<Object>} Evento creado
   */
  async createEvent(eventData, calendarId = 'primary') {
    try {
      const event = {
        summary: eventData.summary,
        description: eventData.description || '',
        start: eventData.start,
        end: eventData.end,
        attendees: eventData.attendees || [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 día antes
            { method: 'popup', minutes: 30 }       // 30 min antes
          ]
        }
      };

      // Agregar Google Meet si se solicita
      if (eventData.conferenceData) {
        event.conferenceData = eventData.conferenceData;
      }

      const response = await this.calendar.events.insert({
        calendarId,
        resource: event,
        conferenceDataVersion: eventData.conferenceData ? 1 : 0,
        sendNotifications: true // Enviar notificaciones a invitados
      });

      return response.data;
    } catch (error) {
      console.error('[CalendarClient] Error creando evento:', error.message);
      throw new Error(`Error creando evento en Google Calendar: ${error.message}`);
    }
  }

  /**
   * Obtiene un evento por ID
   * @param {string} eventId - ID del evento
   * @param {string} calendarId - ID del calendario
   * @returns {Promise<Object>} Evento
   */
  async getEvent(eventId, calendarId = 'primary') {
    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId
      });

      return response.data;
    } catch (error) {
      console.error('[CalendarClient] Error obteniendo evento:', error.message);
      throw new Error(`Error obteniendo evento: ${error.message}`);
    }
  }

  /**
   * Actualiza un evento existente
   * @param {string} eventId - ID del evento
   * @param {Object} updates - Campos a actualizar
   * @param {string} calendarId - ID del calendario
   * @returns {Promise<Object>} Evento actualizado
   */
  async updateEvent(eventId, updates, calendarId = 'primary') {
    try {
      const response = await this.calendar.events.patch({
        calendarId,
        eventId,
        resource: updates,
        sendNotifications: true
      });

      return response.data;
    } catch (error) {
      console.error('[CalendarClient] Error actualizando evento:', error.message);
      throw new Error(`Error actualizando evento: ${error.message}`);
    }
  }

  /**
   * Elimina un evento
   * @param {string} eventId - ID del evento
   * @param {string} calendarId - ID del calendario
   * @returns {Promise<void>}
   */
  async deleteEvent(eventId, calendarId = 'primary') {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendNotifications: true
      });
    } catch (error) {
      console.error('[CalendarClient] Error eliminando evento:', error.message);
      throw new Error(`Error eliminando evento: ${error.message}`);
    }
  }

  /**
   * Lista eventos en un rango de fechas
   * @param {Object} options - Opciones de búsqueda
   * @param {Date} options.timeMin - Fecha mínima
   * @param {Date} options.timeMax - Fecha máxima
   * @param {number} options.maxResults - Máximo de resultados
   * @param {string} calendarId - ID del calendario
   * @returns {Promise<Array>} Lista de eventos
   */
  async listEvents(options = {}, calendarId = 'primary') {
    try {
      const response = await this.calendar.events.list({
        calendarId,
        timeMin: options.timeMin?.toISOString(),
        timeMax: options.timeMax?.toISOString(),
        maxResults: options.maxResults || 10,
        singleEvents: true,
        orderBy: 'startTime'
      });

      return response.data.items || [];
    } catch (error) {
      console.error('[CalendarClient] Error listando eventos:', error.message);
      throw new Error(`Error listando eventos: ${error.message}`);
    }
  }

  /**
   * Obtiene información de todos los calendarios del usuario
   * @returns {Promise<Array>} Lista de calendarios
   */
  async listCalendars() {
    try {
      const response = await this.calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      console.error('[CalendarClient] Error listando calendarios:', error.message);
      throw new Error(`Error listando calendarios: ${error.message}`);
    }
  }

  /**
   * Busca slots disponibles en el calendario
   * @param {Date} startDate - Fecha de inicio de búsqueda
   * @param {Date} endDate - Fecha de fin de búsqueda
   * @param {number} durationMinutes - Duración del slot en minutos
   * @param {string} calendarId - ID del calendario
   * @returns {Promise<Array>} Lista de slots disponibles
   */
  async findAvailableSlots(startDate, endDate, durationMinutes, calendarId = 'primary') {
    try {
      // Obtener eventos existentes
      const events = await this.listEvents({
        timeMin: startDate,
        timeMax: endDate
      }, calendarId);

      // Lógica simplificada: retornar slots de 1 hora entre 9am-6pm
      const availableSlots = [];
      const current = new Date(startDate);

      while (current < endDate) {
        const hour = current.getHours();

        // Solo horario de oficina
        if (hour >= 9 && hour < 18) {
          const slotEnd = new Date(current.getTime() + durationMinutes * 60000);

          // Verificar si hay conflictos con eventos existentes
          const hasConflict = events.some(event => {
            const eventStart = new Date(event.start.dateTime || event.start.date);
            const eventEnd = new Date(event.end.dateTime || event.end.date);

            return (current >= eventStart && current < eventEnd) ||
                   (slotEnd > eventStart && slotEnd <= eventEnd);
          });

          if (!hasConflict) {
            availableSlots.push({
              start: new Date(current),
              end: new Date(slotEnd)
            });
          }
        }

        // Avanzar 30 minutos
        current.setMinutes(current.getMinutes() + 30);
      }

      return availableSlots;
    } catch (error) {
      console.error('[CalendarClient] Error buscando slots:', error.message);
      throw new Error(`Error buscando slots disponibles: ${error.message}`);
    }
  }
}
