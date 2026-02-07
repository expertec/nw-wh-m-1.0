import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Encripta un texto usando AES-256-GCM con clave derivada por tenant
 * @param {string} plaintext - Texto a encriptar
 * @param {string} masterKey - Clave maestra (debe estar en .env)
 * @param {string} tenantId - ID del tenant para derivar clave única
 * @returns {string} Texto encriptado en formato: salt:iv:authTag:encrypted
 */
export function encrypt(plaintext, masterKey, tenantId) {
  if (!plaintext || !masterKey || !tenantId) {
    throw new Error('encrypt() requiere plaintext, masterKey y tenantId');
  }

  // Derivar clave específica del tenant usando PBKDF2
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(
    masterKey + tenantId,
    salt,
    100000, // 100k iteraciones (seguridad vs performance)
    32,     // 256 bits
    'sha256'
  );

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Formato: salt:iv:authTag:encrypted
  return [
    salt.toString('hex'),
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted
  ].join(':');
}

/**
 * Desencripta un texto usando AES-256-GCM
 * @param {string} encryptedData - Texto encriptado en formato salt:iv:authTag:encrypted
 * @param {string} masterKey - Clave maestra (misma usada en encrypt)
 * @param {string} tenantId - ID del tenant
 * @returns {string} Texto desencriptado
 */
export function decrypt(encryptedData, masterKey, tenantId) {
  if (!encryptedData || !masterKey || !tenantId) {
    throw new Error('decrypt() requiere encryptedData, masterKey y tenantId');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 4) {
    throw new Error('Formato de datos encriptados inválido');
  }

  const [saltHex, ivHex, authTagHex, encrypted] = parts;

  // Derivar la misma clave usando el salt guardado
  const salt = Buffer.from(saltHex, 'hex');
  const key = crypto.pbkdf2Sync(
    masterKey + tenantId,
    salt,
    100000,
    32,
    'sha256'
  );

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Genera una clave de encriptación aleatoria segura
 * Útil para generar ENCRYPTION_KEY en .env
 * @returns {string} Clave hexadecimal de 64 caracteres (256 bits)
 */
export function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}
