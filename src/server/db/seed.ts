import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { db, pool } from './index.js';
import { ensureSchema } from './migrate.js';
import {
  organizations,
  teams,
  teamCapabilities,
  teamPreferences,
  users,
  tractors,
  trailers,
  couplings,
  breakdownCategories,
  garages,
  drivers,
} from './schema.js';
import { hashPin, normalizePhone } from '../auth/pin.js';
import type { VehicleStatus, TrailerType } from '../../shared/types.js';
import { DEFAULT_INCIDENT_CATALOG } from '../../shared/incident-catalog.js';

export async function ensureSeedData(): Promise<void> {
  // S'assurer que le schéma de tables existe
  await ensureSchema();

  // 1. Vérification d'idempotence : s'il existe déjà des organisations, ne pas dupliquer
  const existingOrgs = await db.select().from(organizations);
  if (existingOrgs.length > 0) {
    console.log(`ℹ️ Base de données déjà initialisée (${existingOrgs.length} organisations trouvées). Seed ignoré.`);
    return;
  }

  console.log('🌱 Démarrage de l’initialisation des données locales fictives (Mock Seed)...');

  // 2. Création des Organisations fictives
  const [sahelTrans] = await db
    .insert(organizations)
    .values({
      name: 'SAHEL TRANS EXPRESS (LOCAL)',
      slug: 'sahel-trans-local',
      subscriptionStatus: 'active',
    })
    .returning();

  const [dakarLogistics] = await db
    .insert(organizations)
    .values({
      name: 'DAKAR LOGISTICS MOCK (LOCAL)',
      slug: 'dakar-logistics-local',
      subscriptionStatus: 'active',
    })
    .returning();

  // 3. Configuration des Équipes pour chaque organisation
  const teamConfigs = [
    {
      name: 'Exploitation',
      description: 'Gestion quotidienne des plannings, attelages et mouvements',
      capabilities: [
        'fleet:read',
        'fleet:manage',
        'fleet:import',
        'couplings:change',
        'incidents:create',
        'incidents:read',
      ],
      preferences: {
        default_view: 'dashboard',
        'menu:excluded_items': '[]',
      },
    },
    {
      name: 'Maintenance',
      description: 'Suivi des révisions mécaniques, pannes et ateliers',
      capabilities: [
        'fleet:read',
        'incidents:create',
        'incidents:read',
        'incidents:manage',
        'settings:manage',
      ],
      preferences: {
        default_view: 'incidents',
        'menu:excluded_items': '["couplings"]',
      },
    },
    {
      name: 'Terrain',
      description: 'Opérateurs de parc, conducteurs et contrôle physique',
      capabilities: [
        'fleet:read',
        'couplings:change',
        'incidents:create',
        'incidents:read',
      ],
      preferences: {
        default_view: 'fleet',
        'menu:excluded_items': '["members", "settings"]',
      },
    },
  ];

  const sahelTeams: Record<string, string> = {};

  for (const org of [sahelTrans, dakarLogistics]) {
    for (const conf of teamConfigs) {
      const [insertedTeam] = await db
        .insert(teams)
        .values({
          organizationId: org.id,
          name: conf.name,
          description: conf.description,
        })
        .returning();

      if (org.id === sahelTrans.id) {
        sahelTeams[conf.name] = insertedTeam.id;
      }

      // Insertion des capabilities
      for (const cap of conf.capabilities) {
        await db.insert(teamCapabilities).values({
          teamId: insertedTeam.id,
          capability: cap,
        });
      }

      // Insertion des préférences
      for (const [key, val] of Object.entries(conf.preferences)) {
        await db.insert(teamPreferences).values({
          teamId: insertedTeam.id,
          preferenceKey: key,
          preferenceValue: val,
        });
      }
    }
  }

  // 4. Utilisateurs locaux par défaut (Code PIN 1234)
  const defaultPinHash = hashPin('1234');

  // Super Admin (sans organisation spécifique)
  await db.insert(users).values({
    organizationId: null,
    phone: normalizePhone('+221770000000'),
    email: 'admin.local@logicam.dev',
    pinHash: defaultPinHash,
    firstName: 'Sylvain',
    lastName: 'SuperAdmin (Local)',
    role: 'SUPER_ADMIN',
    status: 'active',
  });

  // Admin Sahel Trans
  await db.insert(users).values({
    organizationId: sahelTrans.id,
    phone: normalizePhone('+221771234567'),
    email: 'admin@saheltrans.local',
    pinHash: defaultPinHash,
    firstName: 'Mamadou',
    lastName: 'Ba (Admin Sahel)',
    role: 'ORG_ADMIN',
    status: 'active',
  });

  // Agent Terrain Sahel Trans
  await db.insert(users).values({
    organizationId: sahelTrans.id,
    teamId: sahelTeams['Terrain'],
    phone: normalizePhone('+221789876543'),
    email: 'terrain@saheltrans.local',
    pinHash: defaultPinHash,
    firstName: 'Fatou',
    lastName: 'Sow (Terrain Sahel)',
    role: 'MEMBER',
    status: 'active',
  });

  // Admin Dakar Logistics Mock
  await db.insert(users).values({
    organizationId: dakarLogistics.id,
    phone: normalizePhone('+221772223344'),
    email: 'admin@dakarlogistics.local',
    pinHash: defaultPinHash,
    firstName: 'Ousmane',
    lastName: 'Cissé (Admin Dakar Log)',
    role: 'ORG_ADMIN',
    status: 'active',
  });

  // 5. Catégories de pannes & Sujets de maintenance par défaut (Référentiel complet)
  const defaultGarages = [
    { name: 'Atelier Mock Bel-Air', location: 'Zone Industrielle Bel-Air, Dakar', contactPhone: '+221338111111' },
    { name: 'Garage Test Diamniadio', location: 'Pôle Urbain Diamniadio', contactPhone: '+221338222222' },
  ];

  for (const org of [sahelTrans, dakarLogistics]) {
    for (const cat of DEFAULT_INCIDENT_CATALOG) {
      await db.insert(breakdownCategories).values({
        organizationId: org.id,
        name: cat.name,
        code: cat.code,
        severity: cat.severity,
        categoryType: cat.categoryType,
        description: cat.description,
      });
    }

    for (const gar of defaultGarages) {
      await db.insert(garages).values({
        organizationId: org.id,
        name: gar.name,
        location: gar.location,
        contactPhone: gar.contactPhone,
      });
    }
  }

  // 6. Flotte fictive locale (12 ensembles pour Sahel Trans + 8 ensembles pour Dakar Logistics)
  const mockVehicles = [
    // Flotte Sahel Trans Express (12 ensembles)
    { org: sahelTrans, prefix: 'ST', count: 12, brands: ['MERCEDES ACTROS', 'MAN TGX', 'VOLVO FH16'] },
    // Flotte Dakar Logistics (8 ensembles)
    { org: dakarLogistics, prefix: 'DL', count: 8, brands: ['SCANIA R500', 'RENAULT T-HIGH'] },
  ];

  let orderIndex = 1;

  for (const fleetConfig of mockVehicles) {
    console.log(`🚛 Création de ${fleetConfig.count} ensembles fictifs pour ${fleetConfig.org.name}...`);

    for (let i = 1; i <= fleetConfig.count; i++) {
      const tractorPlate = `LOCAL-${fleetConfig.prefix}-${String(100 + i)}`;
      const trailerPlate = `LOCAL-REM-${fleetConfig.prefix}-${String(200 + i)}`;
      const brand = fleetConfig.brands[(i - 1) % fleetConfig.brands.length];
      const trailerType: TrailerType = i % 3 === 0 ? 'PLATEAU' : i % 3 === 1 ? 'BENNE' : 'CITERNE';

      // Statuts variés : quelques pannes et maintenances pour avoir des KPIs réalistes
      let vehicleStatus: VehicleStatus = 'in_service';
      if (i === 3) vehicleStatus = 'breakdown';
      else if (i === 7) vehicleStatus = 'maintenance';

      const mileageKm = 45000 + (i * 12500);
      const nextOilChangeKm = mileageKm + 10000;

      // 1. Tracteur
      const [insertedTractor] = await db
        .insert(tractors)
        .values({
          organizationId: fleetConfig.org.id,
          plateNumber: tractorPlate,
          brandModel: brand,
          status: vehicleStatus,
          mileageKm,
          nextOilChangeKm,
        })
        .returning();

      // 2. Remorque
      const [insertedTrailer] = await db
        .insert(trailers)
        .values({
          organizationId: fleetConfig.org.id,
          plateNumber: trailerPlate,
          trailerType,
          status: vehicleStatus,
        })
        .returning();

      // 3. Chauffeur
      const driverFullName = `Conducteur Test ${fleetConfig.prefix}-${String(i).padStart(2, '0')}`;
      const [insertedDriver] = await db
        .insert(drivers)
        .values({
          organizationId: fleetConfig.org.id,
          fullName: driverFullName,
          status: 'active',
        })
        .returning();

      // 4. Attelage actif
      await db.insert(couplings).values({
        organizationId: fleetConfig.org.id,
        orderNumber: `#ORD-LOCAL-${String(orderIndex).padStart(4, '0')}`,
        tractorId: insertedTractor.id,
        trailerId: insertedTrailer.id,
        isActive: true,
        driverId: insertedDriver.id,
        driverName: driverFullName,
      });

      orderIndex++;
    }
  }

  console.log('✅ Mock Seed LogiCam local terminé avec succès.');
}

// Exécution directe en CLI
if (process.argv[1]?.includes('seed')) {
  ensureSeedData()
    .then(() => {
      console.log('Seed terminé avec succès.');
      return pool.end();
    })
    .catch((err) => {
      console.error('Erreur lors du seed :', err);
      process.exit(1);
    });
}
