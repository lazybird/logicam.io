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
 * Génère les variantes possibles d'un numéro pour la recherche en base
 * Permet aux utilisateurs de saisir un numéro national (ex: 771234567)
 * ou avec indicatif (ex: +221771234567) indifféremment.
 */
export function getPhoneVariants(phoneInput: string): string[] {
  const normalized = normalizePhone(phoneInput);
  if (!normalized) return [];

  const variants = new Set<string>();
  variants.add(normalized);

  if (normalized.startsWith('+')) {
    // Retirer le +
    const withoutPlus = normalized.slice(1);
    variants.add(withoutPlus);
    // Si indicatif courant (ex: 221 pour Sénégal), ajouter la version nationale sans indicatif
    if (withoutPlus.startsWith('221') && withoutPlus.length > 3) {
      variants.add(withoutPlus.slice(3));
    }
  } else {
    // Si saisi sans +, tester avec + direct
    variants.add(`+${normalized}`);
    // Si saisi comme numéro national sénégalais (ex: 9 chiffres commençant par 7x ou 3x)
    if (/^[37]\d{8}$/.test(normalized)) {
      variants.add(`+221${normalized}`);
      variants.add(`221${normalized}`);
    }
  }

  return Array.from(variants);
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
