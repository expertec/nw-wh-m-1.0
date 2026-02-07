import { google } from 'googleapis';
import { encryptToken, decryptToken, encryptCredentials } from './tokenEncryption.js';
import { configCol } from '../../tenantContext.js';
import { now } from '../../firebaseAdmin.js';

/**
 * Maneja el flujo OAuth 2.0 con Google Calendar
 */
export class GoogleCalendarOAuth {
  /**
   * Genera la URL de autorización OAuth de Google
   * @param {string} tenantId - ID del tenant
   * @param {string} redirectUri - URL de callback
   * @returns {Promise<string>} URL de autorización
   */
  static async getAuthUrl(tenantId, redirectUri) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Para obtener refresh token
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      state: tenantId, // Para validar en el callback
      prompt: 'consent' // Fuerza el consent screen para obtener refresh token
    });

    return authUrl;
  }

  /**
   * Maneja el callback de OAuth y guarda los tokens encriptados
   * @param {string} code - Código de autorización de Google
   * @param {string} tenantId - ID del tenant
   * @param {string} redirectUri - URL de callback (debe coincidir con la usada en getAuthUrl)
   * @returns {Promise<Object>} Resultado del proceso
   */
  static async handleCallback(code, tenantId, redirectUri) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      // Intercambiar código por tokens
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.refresh_token) {
        throw new Error(
          'No se recibió refresh_token. Asegúrate de usar prompt=consent en la URL de autorización.'
        );
      }

      // Obtener información del usuario (email)
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      // Encriptar tokens
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY no está configurada en .env');
      }

      const encrypted = encryptCredentials(
        {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: tokens.refresh_token,
          accessToken: tokens.access_token
        },
        encryptionKey,
        tenantId
      );

      // Guardar en Firestore
      await configCol(tenantId)
        .collection('integrations')
        .doc('google-calendar')
        .set({
          provider: 'google-calendar',
          ...encrypted,
          accessTokenExpiresAt: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : new Date(Date.now() + 3600 * 1000), // 1 hora por defecto
          email: userInfo.data.email,
          calendarId: 'primary',
          defaultDuration: 60,
          enabled: true,
          createdAt: now(),
          lastRefreshedAt: now()
        });

      console.log(`[OAuth] Google Calendar conectado exitosamente para tenant ${tenantId}`);

      return {
        success: true,
        email: userInfo.data.email,
        message: 'Google Calendar conectado exitosamente'
      };
    } catch (error) {
      console.error('[OAuth] Error en handleCallback:', error);
      throw new Error(`Error conectando Google Calendar: ${error.message}`);
    }
  }

  /**
   * Obtiene un access token válido (refresca si expiró)
   * @param {string} tenantId - ID del tenant
   * @param {Object} credentials - Credenciales encriptadas desde Firestore
   * @returns {Promise<string>} Access token válido
   */
  static async getValidAccessToken(tenantId, credentials) {
    try {
      const now = new Date();
      const expiresAt = credentials.accessTokenExpiresAt?.toDate
        ? credentials.accessTokenExpiresAt.toDate()
        : new Date(credentials.accessTokenExpiresAt);

      // Si el token no expiró (con margen de 5 minutos), devolverlo
      const expiryMargin = new Date(expiresAt.getTime() - 5 * 60 * 1000);

      if (now < expiryMargin) {
        const encryptionKey = process.env.ENCRYPTION_KEY;
        return decryptToken(credentials.accessToken, encryptionKey, tenantId);
      }

      // El token expiró, refrescar
      console.log(`[OAuth] Access token expirado para tenant ${tenantId}, refrescando...`);
      return await this.refreshAccessToken(tenantId, credentials);
    } catch (error) {
      console.error('[OAuth] Error obteniendo access token válido:', error);
      throw new Error(`Error obteniendo access token: ${error.message}`);
    }
  }

  /**
   * Refresca el access token usando el refresh token
   * @param {string} tenantId - ID del tenant
   * @param {Object} credentials - Credenciales encriptadas (opcional, se pueden leer de Firestore)
   * @returns {Promise<string>} Nuevo access token
   */
  static async refreshAccessToken(tenantId, credentials = null) {
    try {
      // Si no se pasan credenciales, leerlas de Firestore
      if (!credentials) {
        const doc = await configCol(tenantId)
          .collection('integrations')
          .doc('google-calendar')
          .get();

        if (!doc.exists) {
          throw new Error('Google Calendar no está configurado para este tenant');
        }

        credentials = doc.data();
      }

      // Desencriptar refresh token
      const encryptionKey = process.env.ENCRYPTION_KEY;
      const refreshToken = decryptToken(credentials.refreshToken, encryptionKey, tenantId);

      // Crear cliente OAuth y refrescar
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );

      oauth2Client.setCredentials({ refresh_token: refreshToken });

      const { credentials: newTokens } = await oauth2Client.refreshAccessToken();

      // Encriptar y guardar nuevo access token
      const newAccessTokenEncrypted = encryptToken(
        newTokens.access_token,
        encryptionKey,
        tenantId
      );

      await configCol(tenantId)
        .collection('integrations')
        .doc('google-calendar')
        .update({
          accessToken: newAccessTokenEncrypted,
          accessTokenExpiresAt: new Date(newTokens.expiry_date),
          lastRefreshedAt: now()
        });

      console.log(`[OAuth] Access token refrescado exitosamente para tenant ${tenantId}`);

      return newTokens.access_token;
    } catch (error) {
      console.error('[OAuth] Error refrescando access token:', error);
      throw new Error(`Error refrescando access token: ${error.message}`);
    }
  }

  /**
   * Desconecta Google Calendar eliminando las credenciales
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<void>}
   */
  static async disconnect(tenantId) {
    try {
      await configCol(tenantId)
        .collection('integrations')
        .doc('google-calendar')
        .delete();

      console.log(`[OAuth] Google Calendar desconectado para tenant ${tenantId}`);
    } catch (error) {
      console.error('[OAuth] Error desconectando Google Calendar:', error);
      throw new Error(`Error desconectando Google Calendar: ${error.message}`);
    }
  }

  /**
   * Obtiene el estado de la conexión de Google Calendar
   * @param {string} tenantId - ID del tenant
   * @returns {Promise<Object>} Estado de la conexión
   */
  static async getConnectionStatus(tenantId) {
    try {
      const doc = await configCol(tenantId)
        .collection('integrations')
        .doc('google-calendar')
        .get();

      if (!doc.exists) {
        return {
          connected: false,
          message: 'Google Calendar no está conectado'
        };
      }

      const data = doc.data();

      return {
        connected: data.enabled === true,
        email: data.email,
        calendarId: data.calendarId,
        createdAt: data.createdAt,
        lastRefreshedAt: data.lastRefreshedAt
      };
    } catch (error) {
      console.error('[OAuth] Error obteniendo estado de conexión:', error);
      // En lugar de lanzar error, retornar estado desconectado
      return {
        connected: false,
        message: 'Error al verificar conexión de Google Calendar',
        error: error.message
      };
    }
  }
}
