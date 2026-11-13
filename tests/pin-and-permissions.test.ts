import { describe, it, expect } from 'vitest';
import { normalizePhone, getPhoneVariants, hashPin, verifyPin } from '../src/server/auth/pin.js';
import { hasCapability } from '../src/shared/permissions.js';

describe('Auth PIN & Phone Normalization', () => {
  it('normalizes phone numbers consistently', () => {
    expect(normalizePhone('+221 77 123 45 67')).toBe('+221771234567');
    expect(normalizePhone('06 12 34 56 78')).toBe('0612345678');
    expect(normalizePhone('77-123-45-67')).toBe('771234567');
  });

  it('generates variants for national and international phone lookups', () => {
    const variantsNational = getPhoneVariants('77 123 45 67');
    expect(variantsNational).toContain('771234567');
    expect(variantsNational).toContain('+221771234567');

    const variantsIntl = getPhoneVariants('+221 77 123 45 67');
    expect(variantsIntl).toContain('+221771234567');
    expect(variantsIntl).toContain('771234567');
  });

  it('hashes and verifies 4-digit PIN codes', () => {
    const hash = hashPin('1234');
    expect(verifyPin('1234', hash)).toBe(true);
    expect(verifyPin('0000', hash)).toBe(false);
    expect(verifyPin('1234', 'invalid-hash')).toBe(false);
    expect(verifyPin('', hash)).toBe(false);
  });
});

describe('Multi-tenant Capabilities evaluation', () => {
  it('grants all capabilities to SUPER_ADMIN and ORG_ADMIN', () => {
    expect(hasCapability('SUPER_ADMIN', [], 'fleet:manage')).toBe(true);
    expect(hasCapability('ORG_ADMIN', [], 'members:manage')).toBe(true);
  });

  it('checks team capabilities for MEMBER role', () => {
    expect(hasCapability('MEMBER', ['fleet:read', 'couplings:change'], 'couplings:change')).toBe(true);
    expect(hasCapability('MEMBER', ['fleet:read'], 'members:manage')).toBe(false);
    expect(hasCapability('MEMBER', undefined, 'fleet:read')).toBe(false);
  });
});
