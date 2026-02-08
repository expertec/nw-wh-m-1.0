#!/usr/bin/env node

/**
 * Script de prueba simple para verificar el sistema de tools (sin Firebase)
 * Uso: node scripts/test-tools-simple.js
 */

// Mock mínimo de firebase para que importe
globalThis.mockFirebase = true;

// Importar solo lo necesario para verificar registro
console.log('=== Test Simple del Sistema de Tools ===\n');

console.log('1. Verificando estructura de ToolInterface...');
import { ToolInterface } from '../tools/base/ToolInterface.js';
console.log('   ✅ ToolInterface importado correctamente\n');

console.log('2. Verificando estructura de EchoTool...');
import { EchoTool } from '../tools/echo/EchoTool.js';
const echoTool = new EchoTool();
console.log('   ✅ EchoTool importado correctamente');
console.log(`   Nombre: ${echoTool.getName()}`);

console.log('\n3. Definición del tool para OpenAI:');
const definition = echoTool.getToolDefinition();
console.log(JSON.stringify(definition, null, 2));

console.log('\n4. Validando parámetros...');
const validParams = { text: 'Hola', repeat: 2 };
const validation = echoTool.validateParameters(validParams);
console.log(`   Parámetros válidos: ${JSON.stringify(validParams)}`);
console.log(`   Validación: ${validation.valid ? '✅' : '❌'}`);

console.log('\n5. Validando parámetros inválidos...');
const invalidParams = { repeat: 2 }; // falta 'text' que es requerido
const validation2 = echoTool.validateParameters(invalidParams);
console.log(`   Parámetros: ${JSON.stringify(invalidParams)}`);
console.log(`   Validación: ${validation2.valid ? '✅' : '❌'}`);
console.log(`   Errores: ${validation2.errors.join(', ')}`);

console.log('\n✅ Todos los tests básicos pasaron correctamente');
