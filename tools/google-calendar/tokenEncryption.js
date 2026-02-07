import { encrypt, decrypt } from '../../utils/encryption.js';

/**
 * Funciones de encriptación específicas para tokens de Google Calendar
 * Usa las funciones base de utils/encryption.js
 */

/**
 * Encripta tokens de Google Calendar
 * @param {string} token - Token a encriptar
 * @param {string} masterKey - Clave maestra de encriptación
 * @param {string} tenantId - ID del tenant
 * @returns {string} Token encriptado
 */
export function encryptToken(token, masterKey, tenantId) {
  if (!token) {
    throw new Error('Token es requerido para encriptar');
  }

  return encrypt(token, masterKey, tenantId);
}

/**
 * Desencripta tokens de Google Calendar
 * @param {string} encryptedToken - Token encriptado
 * @param {string} masterKey - Clave maestra de encriptación
 * @param {string} tenantId - ID del tenant
 * @returns {string} Token desencriptado
 */
export function decryptToken(encryptedToken, masterKey, tenantId) {
  if (!encryptedToken) {
    throw new Error('Token encriptado es requerido para desencriptar');
  }

  return decrypt(encryptedToken, masterKey, tenantId);
}

/**
 * Encripta un objeto completo de credenciales de Google
 * @param {Object} credentials - Credenciales de Google
 * @param {string} credentials.clientId - Client ID
 * @param {string} credentials.clientSecret - Client Secret
 * @param {string} credentials.refreshToken - Refresh token
 * @param {string} credentials.accessToken - Access token
 * @param {string} masterKey - Clave maestra
 * @param {string} tenantId - ID del tenant
 * @returns {Object} Credenciales encriptadas
 */
export function encryptCredentials(credentials, masterKey, tenantId) {
  return {
    clientId: encryptToken(credentials.clientId, masterKey, tenantId),
    clientSecret: encryptToken(credentials.clientSecret, masterKey, tenantId),
    refreshToken: encryptToken(credentials.refreshToken, masterKey, tenantId),
    accessToken: encryptToken(credentials.accessToken, masterKey, tenantId)
  };
}

/**
 * Desencripta un objeto completo de credenciales de Google
 * @param {Object} encryptedCreds - Credenciales encriptadas
 * @param {string} masterKey - Clave maestra
 * @param {string} tenantId - ID del tenant
 * @returns {Object} Credenciales desencriptadas
 */
export function decryptCredentials(encryptedCreds, masterKey, tenantId) {
  return {
    clientId: decryptToken(encryptedCreds.clientId, masterKey, tenantId),
    clientSecret: decryptToken(encryptedCreds.clientSecret, masterKey, tenantId),
    refreshToken: decryptToken(encryptedCreds.refreshToken, masterKey, tenantId),
    accessToken: decryptToken(encryptedCreds.accessToken, masterKey, tenantId)
  };
}
