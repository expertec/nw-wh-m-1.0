#!/usr/bin/env node

/**
 * Script de prueba para verificar el sistema de tools
 * Uso: node scripts/test-tools.js
 */

import '../tools/echo/EchoTool.js'; // Auto-registrar EchoTool
import { toolRegistry } from '../tools/toolRegistry.js';
import { ToolExecutor } from '../tools/base/ToolExecutor.js';

console.log('=== Test del Sistema de Tools ===\n');

// 1. Verificar tools registrados
console.log('1. Tools registrados:');
const tools = toolRegistry.getToolsInfo();
tools.forEach(tool => {
  console.log(`   - ${tool.name}: ${tool.description}`);
  console.log(`     Parámetros: ${tool.parametersCount}, Requeridos: ${tool.requiredParams.join(', ')}`);
});

console.log('\n2. Definiciones de tools (formato OpenAI):');
const definitions = toolRegistry.getAllDefinitions();
console.log(JSON.stringify(definitions, null, 2));

// 3. Probar ejecución de EchoTool
console.log('\n3. Probando ejecución de EchoTool...');

const testToolCall = {
  id: 'test_call_123',
  toolName: 'echo',
  parameters: {
    text: 'Hola desde el sistema de tools!',
    repeat: 2
  }
};

const testTenantId = 'default';
const testLeadId = 'test_lead_123';

ToolExecutor.executeSingle({
  tenantId: testTenantId,
  leadId: testLeadId,
  toolCall: testToolCall
})
  .then(result => {
    console.log('   Resultado:', JSON.stringify(result, null, 2));
    console.log('\n✅ Test completado exitosamente');
    process.exit(0);
  })
  .catch(error => {
    console.error('   ❌ Error:', error.message);
    process.exit(1);
  });
