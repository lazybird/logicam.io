import { describe, it, expect } from 'vitest';
import { DEFAULT_INCIDENT_CATALOG } from '../src/shared/incident-catalog.js';

describe('DEFAULT_INCIDENT_CATALOG Initial Reference Data', () => {
  it('contains comprehensive breakdown categories and maintenance topics', () => {
    expect(DEFAULT_INCIDENT_CATALOG.length).toBeGreaterThanOrEqual(20);

    const breakdowns = DEFAULT_INCIDENT_CATALOG.filter((i) => i.categoryType === 'breakdown');
    const maintenances = DEFAULT_INCIDENT_CATALOG.filter((i) => i.categoryType === 'maintenance');

    expect(breakdowns.length).toBeGreaterThanOrEqual(10);
    expect(maintenances.length).toBeGreaterThanOrEqual(8);
  });

  it('includes heavy transport essential systems', () => {
    const codes = DEFAULT_INCIDENT_CATALOG.map((i) => i.code);
    // Pannes
    expect(codes).toContain('BRAKES');
    expect(codes).toContain('TIRES');
    expect(codes).toContain('ENGINE');
    expect(codes).toContain('AIR_SYSTEM');
    expect(codes).toContain('COUPLING_SYS');
    expect(codes).toContain('REEFER');

    // Maintenances
    expect(codes).toContain('OIL_CHANGE');
    expect(codes).toContain('PERIODIC_INSPECT');
    expect(codes).toContain('TACHO_CALIBRATION');
    expect(codes).toContain('GREASING');
  });

  it('has valid codes and severities for each item', () => {
    for (const item of DEFAULT_INCIDENT_CATALOG) {
      expect(item.name.trim()).not.toBe('');
      expect(item.code).toMatch(/^[A-Z0-9_]+$/);
      expect(['critical', 'high', 'medium', 'low']).toContain(item.severity);
      expect(['breakdown', 'maintenance']).toContain(item.categoryType);
    }
  });
});
