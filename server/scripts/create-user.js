import admin from 'firebase-admin';
import fs from 'fs';

const keyPath = process.env.SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath) {
  console.error('Missing SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS');
  process.exit(1);
}

const raw = fs.readFileSync(keyPath, 'utf8');
const serviceAccount = JSON.parse(raw);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const [email, password, tenantIdArg, roleArg, tenantNameArg] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node scripts/create-user.js <email> <password> [tenantId] [role] [tenantName]');
  process.exit(1);
}

const tenantId = tenantIdArg || 'default';
const role = roleArg || 'superadmin';
const tenantName = tenantNameArg || tenantId;

let user;
try {
  user = await admin.auth().getUserByEmail(email);
  console.log(`User exists: ${user.uid}`);
} catch (err) {
  if (err?.code === 'auth/user-not-found') {
    user = await admin.auth().createUser({ email, password });
    console.log(`User created: ${user.uid}`);
  } else {
    console.error('Error getting user:', err?.message || err);
    process.exit(1);
  }
}

await admin.auth().setCustomUserClaims(user.uid, { role, tenantId });
console.log(`Claims set: role=${role} tenantId=${tenantId}`);

const db = admin.firestore();
const tenantRef = db.collection('tenants').doc(tenantId);
const tenantSnap = await tenantRef.get();
if (!tenantSnap.exists) {
  const now = new Date();
  await tenantRef.set({
    nombre: tenantName,
    plan: 'basico',
    ownerEmail: email,
    disabled: false,
    createdAt: now,
  });

  await db.collection('tenants').doc(tenantId).collection('config').doc('appConfig').set({
    defaultTrigger: 'NuevoLeadWeb',
    defaultTriggerMetaAds: 'WebPromo',
  });

  console.log(`Tenant created: ${tenantId}`);
} else {
  console.log(`Tenant exists: ${tenantId}`);
}

console.log('Done');
