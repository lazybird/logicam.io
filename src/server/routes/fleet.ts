import { Hono } from 'hono';
import { eq, and, sql, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tractors, trailers, couplings, breakdownCategories, garages } from '../db/schema.js';
import { parseTrucksExcelFile } from '../services/excelImporter.js';
import {
  authMiddleware,
  requireCapability,
  type AuthContextVariables,
} from '../auth/middleware.js';
import type {
  CouplingRowDTO,
  FleetKpiDTO,
  TractorDTO,
  TrailerDTO,
  VehicleStatus,
  TrailerType,
  BreakdownCategoryDTO,
  GarageDTO,
} from '../../shared/types.js';

export const fleetRouter = new Hono<{ Variables: AuthContextVariables }>();

// Protège toutes les routes de la flotte
fleetRouter.use('*', authMiddleware);

/**
 * Vue globale de la flotte : KPIs, Attelages, Tracteurs et Remorques
 */
fleetRouter.get('/', requireCapability('fleet:read'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const includeHistory = c.req.query('includeHistory') === 'true';

  if (!effectiveOrgId) {
    return c.json({ error: 'Aucune organisation sélectionnée' }, 400);
  }

  // 1. Chargement des tracteurs et remorques
  const allTractors = await db
    .select()
    .from(tractors)
    .where(eq(tractors.organizationId, effectiveOrgId));

  const allTrailers = await db
    .select()
    .from(trailers)
    .where(eq(trailers.organizationId, effectiveOrgId));

  const allBreakdownCategories = await db
    .select()
    .from(breakdownCategories)
    .where(eq(breakdownCategories.organizationId, effectiveOrgId));

  const allGarages = await db
    .select()
    .from(garages)
    .where(eq(garages.organizationId, effectiveOrgId));

  // 2. Chargement des attelages
  const couplingsQuery = db
    .select({
      id: couplings.id,
      organizationId: couplings.organizationId,
      orderNumber: couplings.orderNumber,
      tractorId: couplings.tractorId,
      trailerId: couplings.trailerId,
      driverName: couplings.driverName,
      isActive: couplings.isActive,
      coupledAt: couplings.coupledAt,
      uncoupledAt: couplings.uncoupledAt,
      createdById: couplings.createdById,
      tractorPlate: tractors.plateNumber,
      tractorBrandModel: tractors.brandModel,
      tractorStatus: tractors.status,
      tractorMileage: tractors.mileageKm,
      tractorNextOilChange: tractors.nextOilChangeKm,
      trailerPlate: trailers.plateNumber,
      trailerType: trailers.trailerType,
      trailerStatus: trailers.status,
    })
    .from(couplings)
    .leftJoin(tractors, eq(couplings.tractorId, tractors.id))
    .leftJoin(trailers, eq(couplings.trailerId, trailers.id))
    .where(
      includeHistory
        ? eq(couplings.organizationId, effectiveOrgId)
        : and(eq(couplings.organizationId, effectiveOrgId), eq(couplings.isActive, true))
    );

  const couplingsRaw = await couplingsQuery;

  // Ensembles des tracteurs et remorques actuellement couplés
  const activeCoupledTractorIds = new Set<string>();
  const activeCoupledTrailerIds = new Set<string>();

  const couplingsDTO: (CouplingRowDTO & {
    tractorBrandModel?: string | null;
    mileageKm?: number;
    nextOilChangeKm?: number | null;
  })[] = [];

  for (const row of couplingsRaw) {
    if (row.isActive) {
      activeCoupledTractorIds.add(row.tractorId);
      activeCoupledTrailerIds.add(row.trailerId);
    }

    couplingsDTO.push({
      id: row.id,
      organizationId: row.organizationId,
      orderNumber: row.orderNumber,
      tractorId: row.tractorId,
      trailerId: row.trailerId,
      tractorPlate: row.tractorPlate || 'N/A',
      trailerPlate: row.trailerPlate || 'N/A',
      trailerType: row.trailerType || 'BENNE',
      tractorStatus: (row.tractorStatus as VehicleStatus) || 'in_service',
      trailerStatus: (row.trailerStatus as VehicleStatus) || 'in_service',
      driverName: row.driverName,
      isActive: row.isActive,
      coupledAt: row.coupledAt.toISOString(),
      uncoupledAt: row.uncoupledAt ? row.uncoupledAt.toISOString() : null,
      createdById: row.createdById,
      tractorBrandModel: row.tractorBrandModel,
      mileageKm: row.tractorMileage ?? 0,
      nextOilChangeKm: row.tractorNextOilChange,
    });
  }

  // Marquer le statut couplé sur les tracteurs et remorques
  const tractorsDTO: TractorDTO[] = allTractors.map((t) => ({
    id: t.id,
    organizationId: t.organizationId,
    plateNumber: t.plateNumber,
    brandModel: t.brandModel,
    status: t.status as VehicleStatus,
    mileageKm: t.mileageKm,
    nextOilChangeKm: t.nextOilChangeKm,
    createdAt: t.createdAt.toISOString(),
    isCoupled: activeCoupledTractorIds.has(t.id),
  }));

  const trailersDTO: TrailerDTO[] = allTrailers.map((tr) => ({
    id: tr.id,
    organizationId: tr.organizationId,
    plateNumber: tr.plateNumber,
    trailerType: tr.trailerType as TrailerType,
    status: tr.status as VehicleStatus,
    createdAt: tr.createdAt.toISOString(),
    isCoupled: activeCoupledTrailerIds.has(tr.id),
  }));

  // Calcul des KPIs
  const activeCouplingsList = couplingsDTO.filter((c) => c.isActive);
  const totalCouplings = activeCouplingsList.length;

  let inServiceCouplings = 0;
  let breakdownCouplings = 0;
  let maintenanceCouplings = 0;

  for (const c of activeCouplingsList) {
    if (c.tractorStatus === 'breakdown' || c.trailerStatus === 'breakdown') {
      breakdownCouplings++;
    } else if (c.tractorStatus === 'maintenance' || c.trailerStatus === 'maintenance') {
      maintenanceCouplings++;
    } else {
      inServiceCouplings++;
    }
  }

  let oilChangesDueCount = 0;
  for (const t of allTractors) {
    if (t.nextOilChangeKm != null && t.nextOilChangeKm - t.mileageKm <= 5000) {
      oilChangesDueCount++;
    }
  }

  const kpis: FleetKpiDTO & { oilChangesDueCount: number } = {
    totalCouplings,
    inServiceCouplings,
    breakdownCouplings,
    maintenanceCouplings,
    freeTractors: allTractors.length - activeCoupledTractorIds.size,
    freeTrailers: allTrailers.length - activeCoupledTrailerIds.size,
    totalTractors: allTractors.length,
    totalTrailers: allTrailers.length,
    oilChangesDueCount,
  };

  const breakdownCategoriesDTO: BreakdownCategoryDTO[] = allBreakdownCategories.map((c) => ({
    id: c.id,
    organizationId: c.organizationId,
    name: c.name,
    code: c.code,
    severity: c.severity,
  }));

  const garagesDTO: GarageDTO[] = allGarages.map((g) => ({
    id: g.id,
    organizationId: g.organizationId,
    name: g.name,
    location: g.location,
    contactPhone: g.contactPhone,
  }));

  return c.json({
    kpis,
    couplings: couplingsDTO,
    tractors: tractorsDTO,
    trailers: trailersDTO,
    breakdownCategories: breakdownCategoriesDTO,
    garages: garagesDTO,
  });
});

/**
 * Création d'un tracteur
 */
fleetRouter.post('/tractors', requireCapability('fleet:manage'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const body = await c.req.json().catch(() => null);

  if (!body || !body.plateNumber) {
    return c.json({ error: 'Immatriculation du tracteur obligatoire' }, 400);
  }

  const plateNumber = String(body.plateNumber).trim().toUpperCase();

  const [inserted] = await db
    .insert(tractors)
    .values({
      organizationId: effectiveOrgId,
      plateNumber,
      brandModel: body.brandModel ? String(body.brandModel).trim() : null,
      status: body.status || 'in_service',
      mileageKm: typeof body.mileageKm === 'number' ? body.mileageKm : 0,
      nextOilChangeKm: typeof body.nextOilChangeKm === 'number' ? body.nextOilChangeKm : null,
    })
    .returning();

  return c.json(
    {
      id: inserted.id,
      organizationId: inserted.organizationId,
      plateNumber: inserted.plateNumber,
      brandModel: inserted.brandModel,
      status: inserted.status,
      mileageKm: inserted.mileageKm,
      nextOilChangeKm: inserted.nextOilChangeKm,
      createdAt: inserted.createdAt.toISOString(),
      isCoupled: false,
    },
    201
  );
});

/**
 * Modification d'un tracteur (statut, kilométrage, vidange)
 */
fleetRouter.patch('/tractors/:id', async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const id = c.req.param('id');
  if (!id) {
    return c.json({ error: 'ID tracteur requis' }, 400);
  }
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Données requises' }, 400);
  }

  const updateData: {
    plateNumber?: string;
    brandModel?: string | null;
    status?: string;
    mileageKm?: number;
    nextOilChangeKm?: number | null;
  } = {};

  if (body.plateNumber) updateData.plateNumber = String(body.plateNumber).trim().toUpperCase();
  if (body.brandModel !== undefined) updateData.brandModel = body.brandModel;
  if (body.status && ['in_service', 'breakdown', 'maintenance'].includes(body.status)) {
    updateData.status = body.status;
  }
  if (typeof body.mileageKm === 'number') updateData.mileageKm = body.mileageKm;
  if (body.nextOilChangeKm !== undefined) updateData.nextOilChangeKm = body.nextOilChangeKm;

  const [updated] = await db
    .update(tractors)
    .set(updateData)
    .where(and(eq(tractors.id, id), eq(tractors.organizationId, effectiveOrgId)))
    .returning();

  if (!updated) {
    return c.json({ error: 'Tracteur introuvable dans cette organisation' }, 404);
  }

  return c.json({
    id: updated.id,
    organizationId: updated.organizationId,
    plateNumber: updated.plateNumber,
    brandModel: updated.brandModel,
    status: updated.status,
    mileageKm: updated.mileageKm,
    nextOilChangeKm: updated.nextOilChangeKm,
    createdAt: updated.createdAt.toISOString(),
  });
});

/**
 * Création d'une remorque
 */
fleetRouter.post('/trailers', requireCapability('fleet:manage'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const body = await c.req.json().catch(() => null);

  if (!body || !body.plateNumber) {
    return c.json({ error: 'Immatriculation de la remorque obligatoire' }, 400);
  }

  const plateNumber = String(body.plateNumber).trim().toUpperCase();

  const [inserted] = await db
    .insert(trailers)
    .values({
      organizationId: effectiveOrgId,
      plateNumber,
      trailerType: body.trailerType || 'BENNE',
      status: body.status || 'in_service',
    })
    .returning();

  return c.json(
    {
      id: inserted.id,
      organizationId: inserted.organizationId,
      plateNumber: inserted.plateNumber,
      trailerType: inserted.trailerType,
      status: inserted.status,
      createdAt: inserted.createdAt.toISOString(),
      isCoupled: false,
    },
    201
  );
});

/**
 * Modification d'une remorque
 */
fleetRouter.patch('/trailers/:id', async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const id = c.req.param('id');
  if (!id) {
    return c.json({ error: 'ID remorque requis' }, 400);
  }
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Données requises' }, 400);
  }

  const updateData: { plateNumber?: string; trailerType?: string; status?: string } = {};

  if (body.plateNumber) updateData.plateNumber = String(body.plateNumber).trim().toUpperCase();
  if (body.trailerType) updateData.trailerType = body.trailerType;
  if (body.status && ['in_service', 'breakdown', 'maintenance'].includes(body.status)) {
    updateData.status = body.status;
  }

  const [updated] = await db
    .update(trailers)
    .set(updateData)
    .where(and(eq(trailers.id, id), eq(trailers.organizationId, effectiveOrgId)))
    .returning();

  if (!updated) {
    return c.json({ error: 'Remorque introuvable dans cette organisation' }, 404);
  }

  return c.json({
    id: updated.id,
    organizationId: updated.organizationId,
    plateNumber: updated.plateNumber,
    trailerType: updated.trailerType,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
  });
});

/**
 * Nouvel attelage ou changement d'attelage
 * (Désattelle automatiquement tout attelage actif précédent sur ce tracteur ou cette remorque)
 */
fleetRouter.post('/couple', requireCapability('couplings:change'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);

  if (!body || !body.tractorId || !body.trailerId) {
    return c.json({ error: 'Tracteur et Remorque obligatoires' }, 400);
  }

  const { tractorId, trailerId, driverName, orderNumber } = body;

  // Vérifier l'appartenance à l'organisation
  const [trac] = await db
    .select()
    .from(tractors)
    .where(and(eq(tractors.id, tractorId), eq(tractors.organizationId, effectiveOrgId)))
    .limit(1);

  const [trail] = await db
    .select()
    .from(trailers)
    .where(and(eq(trailers.id, trailerId), eq(trailers.organizationId, effectiveOrgId)))
    .limit(1);

  if (!trac || !trail) {
    return c.json({ error: 'Tracteur ou remorque introuvable dans votre flotte' }, 404);
  }

  const now = new Date();

  // Désatteler les attelages actifs précédents
  await db
    .update(couplings)
    .set({ isActive: false, uncoupledAt: now })
    .where(
      and(
        eq(couplings.organizationId, effectiveOrgId),
        eq(couplings.isActive, true),
        or(eq(couplings.tractorId, tractorId), eq(couplings.trailerId, trailerId))
      )
    );

  // Générer un numéro d'ordre #ORD-XXXX si non fourni
  const ordNum = orderNumber || `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;

  // Insérer le nouvel attelage
  const [newCoupling] = await db
    .insert(couplings)
    .values({
      organizationId: effectiveOrgId,
      orderNumber: ordNum,
      tractorId,
      trailerId,
      driverName: driverName ? String(driverName).trim() : null,
      isActive: true,
      coupledAt: now,
      createdById: user.id,
    })
    .returning();

  return c.json({
    id: newCoupling.id,
    organizationId: newCoupling.organizationId,
    orderNumber: newCoupling.orderNumber,
    tractorId: newCoupling.tractorId,
    trailerId: newCoupling.trailerId,
    tractorPlate: trac.plateNumber,
    trailerPlate: trail.plateNumber,
    trailerType: trail.trailerType,
    tractorStatus: trac.status as VehicleStatus,
    trailerStatus: trail.status as VehicleStatus,
    driverName: newCoupling.driverName,
    isActive: true,
    coupledAt: newCoupling.coupledAt.toISOString(),
    uncoupledAt: null,
    createdById: newCoupling.createdById,
  });
});

/**
 * Désatteler un attelage
 */
fleetRouter.post('/couplings/:id/uncouple', requireCapability('couplings:change'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const id = c.req.param('id');
  if (!id) {
    return c.json({ error: 'ID attelage requis' }, 400);
  }
  const now = new Date();

  const [updated] = await db
    .update(couplings)
    .set({ isActive: false, uncoupledAt: now })
    .where(and(eq(couplings.id, id), eq(couplings.organizationId, effectiveOrgId)))
    .returning();

  if (!updated) {
    return c.json({ error: 'Attelage introuvable dans cette organisation' }, 404);
  }

  return c.json({ success: true, coupling: updated });
});

/**
 * Import Excel (.xlsx) de la flotte
 */
fleetRouter.post('/import', requireCapability('fleet:import'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const user = c.get('user');

  let buffer: Buffer | null = null;

  const contentType = c.req.header('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.parseBody();
    const file = formData['file'];
    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }
  } else {
    const json = await c.req.json().catch(() => null);
    if (json?.fileBase64) {
      buffer = Buffer.from(json.fileBase64, 'base64');
    }
  }

  if (!buffer) {
    return c.json({ error: 'Fichier Excel (.xlsx) manquant dans la requête' }, 400);
  }

  const rows = await parseTrucksExcelFile(buffer);
  if (rows.length === 0) {
    return c.json({ error: 'Aucun ensemble trouvé dans le fichier Excel' }, 400);
  }

  let importedCount = 0;

  for (const row of rows) {
    // 1. Tracteur
    let [tractor] = await db
      .select()
      .from(tractors)
      .where(
        and(eq(tractors.organizationId, effectiveOrgId), eq(tractors.plateNumber, row.tractorPlate))
      )
      .limit(1);

    if (!tractor) {
      [tractor] = await db
        .insert(tractors)
        .values({
          organizationId: effectiveOrgId,
          plateNumber: row.tractorPlate,
          status: 'in_service',
          mileageKm: 100000,
          nextOilChangeKm: 115000,
        })
        .returning();
    }

    // 2. Remorque
    let [trailer] = await db
      .select()
      .from(trailers)
      .where(
        and(eq(trailers.organizationId, effectiveOrgId), eq(trailers.plateNumber, row.trailerPlate))
      )
      .limit(1);

    if (!trailer) {
      [trailer] = await db
        .insert(trailers)
        .values({
          organizationId: effectiveOrgId,
          plateNumber: row.trailerPlate,
          trailerType: row.trailerType || 'BENNE',
          status: 'in_service',
        })
        .returning();
    }

    // 3. Attelage actif
    // Désactiver d'anciens attelages pour ce tracteur ou cette remorque
    await db
      .update(couplings)
      .set({ isActive: false, uncoupledAt: new Date() })
      .where(
        and(
          eq(couplings.organizationId, effectiveOrgId),
          eq(couplings.isActive, true),
          or(eq(couplings.tractorId, tractor.id), eq(couplings.trailerId, trailer.id))
        )
      );

    await db.insert(couplings).values({
      organizationId: effectiveOrgId,
      orderNumber: row.orderNumber,
      tractorId: tractor.id,
      trailerId: trailer.id,
      isActive: true,
      createdById: user.id,
    });

    importedCount++;
  }

  return c.json({
    success: true,
    importedCount,
  });
});
