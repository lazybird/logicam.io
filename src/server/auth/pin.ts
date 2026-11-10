import crypto from 'node:crypto';

/**
 * Normalise un numéro de téléphone en supprimant les espaces, tirets et séparateurs.
 * Conserve le préfixe international '+' si présent au début.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Hache un code PIN à 4 chiffres avec un sel aléatoire via scrypt.
 * Format de sortie : `salt:derivedKeyHex`
 */
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(pin, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Vérifie un code PIN par rapport au hash scrypt stocké en base.
 * Utilise timingSafeEqual pour se prémunir contre les attaques temporelles.
 */
export function verifyPin(pin: string, storedHash: string): boolean {
  try {
    if (!pin || !storedHash) return false;
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;

    const [salt, keyHex] = parts;
    const keyBuffer = Buffer.from(keyHex, 'hex');
    const testBuffer = crypto.scryptSync(pin, salt, keyBuffer.length);

    return crypto.timingSafeEqual(keyBuffer, testBuffer);
  } catch {
    return false;
  }
}
