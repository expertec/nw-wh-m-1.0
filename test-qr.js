// test-qr.js - Script para probar generación de QR
import QRCode from 'qrcode';

async function testQR() {
  const testData = '1@s.whatsapp.net,abc123,def456';

  console.log('🧪 Probando generación de QR...');
  console.log('Datos de prueba:', testData);

  try {
    const qrDataUrl = await QRCode.toDataURL(testData);
    console.log('✅ QR generado exitosamente');
    console.log('Primeros 100 caracteres:', qrDataUrl.substring(0, 100));
    console.log('Longitud total:', qrDataUrl.length);
    console.log('Tipo:', qrDataUrl.startsWith('data:image/png;base64') ? 'PNG base64 ✅' : 'Formato incorrecto ❌');
  } catch (err) {
    console.error('❌ Error generando QR:', err);
  }
}

testQR().then(() => process.exit(0));
