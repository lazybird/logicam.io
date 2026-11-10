import fs from 'node:fs';
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
} from './schema.js';
import { hashPin, normalizePhone } from '../auth/pin.js';
import type { ParsedTruckRow, VehicleStatus } from '../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function ensureSeedData(): Promise<void> {
  // S'assurer que le schéma de tables existe
  await ensureSchema();

  // 1. Vérification d'idempotence : s'il existe déjà des organisations, ne pas dupliquer
  const existingOrgs = await db.select().from(organizations);
  if (existingOrgs.length > 0) {
    console.log(`ℹ️ Base de données déjà initialisée (${existingOrgs.length} organisations trouvées). Seed ignoré.`);
    return;
  }

  console.log('🌱 Démarrage de l’initialisation des données (Seed)...');

  // 2. Création des Organisations
  const [wal] = await db
    .insert(organizations)
    .values({
      name: 'WEST AFRICA LOGISTICS',
      slug: 'west-africa-logistics',
      subscriptionStatus: 'active',
    })
    .returning();

  const [soyak] = await db
    .insert(organizations)
    .values({
      name: 'SOYAK',
      slug: 'soyak',
      subscriptionStatus: 'active',
    })
    .returning();

  const orgMap: Record<string, typeof wal> = {
    'WEST AFRICA LOGISTICS': wal,
    SOYAK: soyak,
  };

  // 3. Création des Équipes pour WAL et SOYAK
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

  const walTeams: Record<string, string> = {};

  for (const org of [wal, soyak]) {
    for (const conf of teamConfigs) {
      const [insertedTeam] = await db
        .insert(teams)
        .values({
          organizationId: org.id,
          name: conf.name,
          description: conf.description,
        })
        .returning();

      if (org.id === wal.id) {
        walTeams[conf.name] = insertedTeam.id;
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

  // 4. Utilisateurs par défaut (PIN 1234)
  const defaultPinHash = hashPin('1234');

  // Super Admin (sans organisation spécifique)
  await db.insert(users).values({
    organizationId: null,
    phone: normalizePhone('+221770000000'),
    email: 'admin@logicam.io',
    pinHash: defaultPinHash,
    firstName: 'Sylvain',
    lastName: 'SuperAdmin',
    role: 'SUPER_ADMIN',
    status: 'active',
  });

  // Admin WAL
  await db.insert(users).values({
    organizationId: wal.id,
    phone: normalizePhone('+221771234567'),
    email: 'a.diallo@wal.com',
    pinHash: defaultPinHash,
    firstName: 'Amadou',
    lastName: 'Diallo',
    role: 'ORG_ADMIN',
    status: 'active',
  });

  // Agent Terrain WAL
  await db.insert(users).values({
    organizationId: wal.id,
    teamId: walTeams['Terrain'],
    phone: normalizePhone('+221789876543'),
    email: 'a.fall@wal.com',
    pinHash: defaultPinHash,
    firstName: 'Aminata',
    lastName: 'Fall',
    role: 'MEMBER',
    status: 'active',
  });

  // Admin SOYAK
  await db.insert(users).values({
    organizationId: soyak.id,
    phone: normalizePhone('+221772223344'),
    email: 'm.soyak@soyak.net',
    pinHash: defaultPinHash,
    firstName: 'Moussa',
    lastName: 'Soyak',
    role: 'ORG_ADMIN',
    status: 'active',
  });

  // 5. Catégories de pannes & Garages par défaut
  const defaultCategories = [
    { name: 'Moteur / Transmission', code: 'ENGINE', severity: 'high' },
    { name: 'Système de Freinage', code: 'BRAKES', severity: 'critical' },
    { name: 'Pneumatiques', code: 'TIRES', severity: 'medium' },
    { name: 'Électrique / Électronique', code: 'ELECTRICAL', severity: 'medium' },
    { name: 'Carrosserie / Structure', code: 'BODY', severity: 'low' },
  ];

  const defaultGarages = [
    { name: 'Atelier Central Dakar', location: 'Zone Portuaire, Dakar', contactPhone: '+221338000001' },
    { name: 'Garage Zone Industrielle', location: 'KM 14 Route de Rufisque', contactPhone: '+221338000002' },
  ];

  for (const org of [wal, soyak]) {
    for (const cat of defaultCategories) {
      await db.insert(breakdownCategories).values({
        organizationId: org.id,
        name: cat.name,
        code: cat.code,
        severity: cat.severity,
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

  // 6. Insertion des 146 ensembles depuis le fichier JSON exporté
  const candidatePaths = [
    path.join(__dirname, 'seed-data', 'initial-fleet.json'),
    path.resolve(process.cwd(), 'src/server/db/seed-data/initial-fleet.json'),
  ];
  const jsonFleetPath = candidatePaths.find((p) => fs.existsSync(p));
  let fleetRows: ParsedTruckRow[] = [];

  if (jsonFleetPath) {
    const raw = fs.readFileSync(jsonFleetPath, 'utf-8');
    fleetRows = JSON.parse(raw);
  } else {
    throw new Error(`Fichier initial-fleet.json introuvable dans : ${candidatePaths.join(', ')}`);
  }

  console.log(`🚛 Insertion de ${fleetRows.length} ensembles tracteurs / remorques / attelages...`);

  for (let i = 0; i < fleetRows.length; i++) {
    const row = fleetRows[i];
    const org = orgMap[row.organizationName] || wal;
    const num = i + 1;

    // Détermination d'un statut réaliste
    let vehicleStatus: VehicleStatus = 'in_service';
    if (num % 18 === 0) {
      vehicleStatus = 'breakdown';
    } else if (num % 12 === 0) {
      vehicleStatus = 'maintenance';
    }

    const mileageKm = 85000 + ((num * 1234) % 250000);
    const nextOilChangeKm = mileageKm + 15000 - ((num * 321) % 10000);

    // 1. Création du tracteur
    const [insertedTractor] = await db
      .insert(tractors)
      .values({
        organizationId: org.id,
        plateNumber: row.tractorPlate,
        brandModel: num % 2 === 0 ? 'VOLVO FH16' : 'RENAULT T-HIGH',
        status: vehicleStatus,
        mileageKm,
        nextOilChangeKm,
      })
      .returning();

    // 2. Création de la remorque
    const [insertedTrailer] = await db
      .insert(trailers)
      .values({
        organizationId: org.id,
        plateNumber: row.trailerPlate,
        trailerType: (row.trailerType as any) || 'BENNE',
        status: vehicleStatus,
      })
      .returning();

    // 3. Création de l'attelage actif
    await db.insert(couplings).values({
      organizationId: org.id,
      orderNumber: row.orderNumber,
      tractorId: insertedTractor.id,
      trailerId: insertedTrailer.id,
      isActive: true,
      driverName: `Chauffeur #${String(num).padStart(3, '0')}`,
    });
  }

  console.log('✅ Seed LogiCam terminé avec succès.');
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
