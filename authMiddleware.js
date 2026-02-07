// authMiddleware.js - Verifica Firebase ID Token y asigna tenantId + rol
import { admin } from './firebaseAdmin.js';
import { DEFAULT_TENANT_ID } from './tenantContext.js';

// Extrae token Bearer del header Authorization
function extractToken(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'];
  if (!h) return null;
  const parts = String(h).split(' ');
  if (parts.length === 2 && /^bearer$/i.test(parts[0])) return parts[1];
  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Falta token Bearer' });

    const decoded = await admin.auth().verifyIdToken(token);
    const role = decoded.role || decoded.claims?.role || 'agent';
    const tenantId = decoded.tenantId || decoded.tenant_id || decoded.tenant || DEFAULT_TENANT_ID;

    req.user = { uid: decoded.uid, email: decoded.email, role, tenantId };
    req.tenantId = tenantId;
    req.role = role;
    return next();
  } catch (err) {
    console.error('[auth] error verificando token:', err?.message || err);
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// Valida que el tenantId del request coincida con el del token.
// Los superadmin pueden acceder a cualquier tenant.
export function requireTenantMatch(req, res, next) {
  const tokenTenant = req.user?.tenantId;
  const requestedTenant =
    req.headers['x-tenant-id'] ||
    req.body?.tenantId ||
    req.query?.tenantId;

  // Si no se solicita un tenant diferente, pasa
  if (!requestedTenant || requestedTenant === tokenTenant) return next();

  // superadmin puede acceder a cualquier tenant
  if (req.role === 'superadmin') {
    req.tenantId = requestedTenant;
    return next();
  }

  return res.status(403).json({ error: 'No tienes acceso a este tenant' });
}

export function requireRole(roles = []) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.role) return res.status(401).json({ error: 'No autenticado' });
    if (!allowed.includes(req.role)) return res.status(403).json({ error: 'Rol no autorizado' });
    return next();
  };
}
