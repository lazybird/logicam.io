import ExcelJS from 'exceljs';
import type { ParsedTruckRow } from '../../shared/types.js';

/**
 * Analyse un fichier Excel ou un Buffer (.xlsx) contenant la liste des camions
 * Colonnes attendues : N° | TRANSPOTEURS | TRACTEUR | REMORQUE | TYPE DE CAMION
 */
export async function parseTrucksExcelFile(input: string | Buffer): Promise<ParsedTruckRow[]> {
  const workbook = new ExcelJS.Workbook();

  if (typeof input === 'string') {
    await workbook.xlsx.readFile(input);
  } else if (Buffer.isBuffer(input)) {
    await workbook.xlsx.load(input as unknown as ExcelJS.Buffer);
  } else {
    throw new Error('Paramètre d’entrée invalide : chemin string ou Buffer attendu');
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return [];
  }

  const results: ParsedTruckRow[] = [];
  let itemIndex = 0;

  worksheet.eachRow((row, rowNumber) => {
    // Ignorer la ligne d'en-tête
    if (rowNumber === 1) return;

    const rawNum = row.getCell(1).value;
    const rawOrg = row.getCell(2).value;
    const rawTractor = row.getCell(3).value;
    const rawTrailer = row.getCell(4).value;
    const rawType = row.getCell(5).value;

    const orgStr = rawOrg != null ? String(rawOrg).trim() : '';
    const tractorStr = rawTractor != null ? String(rawTractor).trim() : '';
    const trailerStr = rawTrailer != null ? String(rawTrailer).trim() : '';
    const typeStr = rawType != null ? String(rawType).trim() : 'BENNE';

    // Si la ligne ne contient ni tracteur ni remorque ni organisation, la sauter
    if (!tractorStr && !trailerStr && !orgStr) {
      return;
    }

    itemIndex++;

    let num = itemIndex;
    if (typeof rawNum === 'number' && !Number.isNaN(rawNum) && rawNum > 0) {
      num = rawNum;
    } else if (typeof rawNum === 'string') {
      const parsed = parseInt(rawNum.replace(/\D/g, ''), 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        num = parsed;
      }
    }

    const orderNumber = `#ORD-${String(num).padStart(4, '0')}`;

    results.push({
      orderNumber,
      organizationName: orgStr,
      tractorPlate: tractorStr,
      trailerPlate: trailerStr,
      trailerType: typeStr || 'BENNE',
    });
  });

  return results;
}
