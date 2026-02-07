// migrate-tenant-users.js
// Script para crear usuarios de Firebase Auth para tenants existentes que no tienen usuario

import { admin, db } from './firebaseAdmin.js';

async function migrateTenantUsers() {
  console.log('🔄 Iniciando migración de usuarios para tenants...\n');

  try {
    // 1. Obtener todos los tenants de Firestore
    const tenantsSnap = await db.collection('tenants').get();
    const tenants = tenantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`📋 Encontrados ${tenants.length} tenants en Firestore\n`);

    // 2. Obtener todos los usuarios de Firebase Auth
    const authUsers = await admin.auth().listUsers(1000);
    const authEmails = new Set(authUsers.users.map(u => u.email));

    console.log(`👤 Encontrados ${authUsers.users.length} usuarios en Firebase Auth\n`);

    // 3. Procesar cada tenant
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const tenant of tenants) {
      const { id, ownerEmail, nombre } = tenant;

      if (!ownerEmail) {
        console.log(`⏭️  Tenant "${id}" no tiene ownerEmail, omitiendo...`);
        skipped++;
        continue;
      }

      if (authEmails.has(ownerEmail)) {
        console.log(`✅ Usuario ya existe para "${id}" (${ownerEmail})`);
        skipped++;
        continue;
      }

      // Crear usuario
      try {
        // Generar contraseña aleatoria
        const password = `${id}_${Math.random().toString(36).slice(2, 10)}`;

        const userRecord = await admin.auth().createUser({
          email: ownerEmail,
          password: password,
          emailVerified: false,
          displayName: nombre || id,
        });

        // Asignar custom claims
        await admin.auth().setCustomUserClaims(userRecord.uid, {
          role: 'admin',
          tenantId: id,
        });

        console.log(`✅ Usuario creado para tenant "${id}"`);
        console.log(`   📧 Email: ${ownerEmail}`);
        console.log(`   🔑 Password: ${password}`);
        console.log(`   UID: ${userRecord.uid}\n`);

        created++;
      } catch (err) {
        console.error(`❌ Error creando usuario para "${id}":`, err.message);
        errors++;
      }
    }

    // 4. Resumen
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(50));
    console.log(`Total tenants: ${tenants.length}`);
    console.log(`✅ Usuarios creados: ${created}`);
    console.log(`⏭️  Omitidos (ya existían o sin email): ${skipped}`);
    console.log(`❌ Errores: ${errors}`);
    console.log('='.repeat(50));

    if (created > 0) {
      console.log('\n⚠️  IMPORTANTE: Guarda las contraseñas generadas arriba.');
      console.log('   Los usuarios deberán cambiar su contraseña en el primer login.\n');
    }

  } catch (err) {
    console.error('❌ Error en migración:', err);
    process.exit(1);
  }

  process.exit(0);
}

// Ejecutar migración
migrateTenantUsers();
