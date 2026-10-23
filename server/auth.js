import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Contraseñas con scrypt (sal aleatoria por usuario) y sesiones con un token
// firmado con HMAC: "datos.firma", sin guardar nada en el servidor.

const TOKEN_DAYS = 30;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [kind, saltHex, hashHex] = String(stored).split('$');
  if (kind !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

/** Código de recuperación legible: 12 letras y números sin los que se confunden (0/O, 1/I). */
export function newRecoveryCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(12);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/** Para comparar códigos sin que importen mayúsculas, guiones ni espacios. */
export function normalizeCode(code) {
  return String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function newSecret() {
  return randomBytes(32).toString('hex');
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');

export function signToken(userId, secret) {
  const now = Date.now();
  const data = b64(JSON.stringify({ uid: userId, iat: now, exp: now + TOKEN_DAYS * 86_400_000 }));
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

/**
 * Devuelve el id del usuario o null si el token no vale. Con `withTime`, { uid, iat } (iat: cuándo
 * se firmó; 0 en los tokens de antes, que no lo llevaban).
 */
export function readToken(token, secret, { withTime = false } = {}) {
  if (typeof token !== 'string') return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = createHmac('sha256', secret).update(data).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { uid, exp, iat } = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!(exp > Date.now())) return null;
    return withTime ? { uid, iat: Number(iat) || 0 } : uid;
  } catch {
    return null;
  }
}
