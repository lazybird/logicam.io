import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { parseTrucksExcelFile } from '../src/server/services/excelImporter.js';

describe('Excel Importer on LISTE DE CAMIONS.xlsx', () => {
  it('extracts all 146 truck combinations for WEST AFRICA LOGISTICS and SOYAK from file path', async () => {
    const filePath = path.resolve(process.cwd(), '.dev/Sample data/LISTE DE CAMIONS.xlsx');
    const rows = await parseTrucksExcelFile(filePath);

    expect(rows.length).toBe(146);
    expect(rows[0]).toEqual({
      orderNumber: '#ORD-0001',
      organizationName: 'WEST AFRICA LOGISTICS',
      tractorPlate: '5895 CAT',
      trailerPlate: '5910 CAT',
      trailerType: 'BENNE',
    });

    const orgs = new Set(rows.map((r) => r.organizationName));
    expect(orgs.has('WEST AFRICA LOGISTICS')).toBe(true);
    expect(orgs.has('SOYAK')).toBe(true);

    const walRows = rows.filter((r) => r.organizationName === 'WEST AFRICA LOGISTICS');
    const soyakRows = rows.filter((r) => r.organizationName === 'SOYAK');
    expect(walRows.length).toBe(91);
    expect(soyakRows.length).toBe(55);
  });

  it('supports parsing from a Buffer (for HTTP uploads)', async () => {
    const filePath = path.resolve(process.cwd(), '.dev/Sample data/LISTE DE CAMIONS.xlsx');
    const buffer = fs.readFileSync(filePath);
    const rows = await parseTrucksExcelFile(buffer);

    expect(rows.length).toBe(146);
    expect(rows[0].orderNumber).toBe('#ORD-0001');
  });
});
