// server/firebaseAdmin.js
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prioridad de búsqueda de credenciales:
// 1. Render (producción): /etc/secrets/serviceAccountKey.json
// 2. Desarrollo: ./serviceAccountKey.json o ../serviceAccountKey.json
// 3. Variable de entorno FIREBASE_SERVICE_ACCOUNT (JSON string)

let serviceAccount;
const productionPath = '/etc/secrets/serviceAccountKey.json';
const localPath = path.join(__dirname, 'serviceAccountKey.json');
const parentPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (fs.existsSync(productionPath)) {
  // Producción (Render)
  console.log('📋 Usando credenciales de producción');
  const fileData = fs.readFileSync(productionPath, 'utf8');
  serviceAccount = JSON.parse(fileData);
} else if (fs.existsSync(localPath)) {
  // Desarrollo local (server/serviceAccountKey.json)
  console.log('📋 Usando credenciales locales (server/)');
  const fileData = fs.readFileSync(localPath, 'utf8');
  serviceAccount = JSON.parse(fileData);
} else if (fs.existsSync(parentPath)) {
  // Desarrollo local (Proyect/serviceAccountKey.json)
  console.log('📋 Usando credenciales locales (raíz)');
  const fileData = fs.readFileSync(parentPath, 'utf8');
  serviceAccount = JSON.parse(fileData);
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Variable de entorno
  console.log('📋 Usando credenciales de variable de entorno');
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  throw new Error(
    'No se encontraron credenciales de Firebase. Coloca serviceAccountKey.json en:\n' +
    '- Producción: /etc/secrets/serviceAccountKey.json\n' +
    '- Desarrollo: server/serviceAccountKey.json o Proyect/serviceAccountKey.json\n' +
    '- O define FIREBASE_SERVICE_ACCOUNT como variable de entorno'
  );
}

// Inicializa Firebase Admin con las credenciales y el bucket de Storage
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'merkagrama-crm.firebasestorage.app'
});



// Obtén la instancia de Firestore
const db = admin.firestore();

// Helper para timestamps de Firestore
export const now = () => admin.firestore.Timestamp.now();

// Helper para FieldValue
export const FieldValue = admin.firestore.FieldValue;

export { admin, db };
