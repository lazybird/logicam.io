import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
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
} from '../db/schema.js';
import { DEFAULT_INCIDENT_CATALOG } from '../../shared/incident-catalog.js';
import { hashPin, normalizePhone } from '../auth/pin.js';
import {
  authMiddleware,
  requireSuperAdmin,
  type AuthContextVariables,
} from '../auth/middleware.js';
import type { OrganizationDTO } from '../../shared/types.js';

export const organizationsRouter = new Hono<{ Variables: AuthContextVariables }>();

// Toutes les routes d'organisations sont protégées et réservées aux Super Admins
organizationsRouter.use('*', authMiddleware, requireSuperAdmin());

/**
 * Liste toutes les organisations avec statistiques et KPIs globaux
 */
organizationsRouter.get('/', async (c) => {
  const allOrgs = await db.select().from(organizations);

  // Chargement des statistiques pour chaque organisation
  const orgsWithStats = await Promise.all(
    allOrgs.map(async (org) => {
      const [tractorsRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tractors)
        .where(eq(tractors.organizationId, org.id));

      const [trailersRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(trailers)
        .where(eq(trailers.organizationId, org.id));

      const [couplingsRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(couplings)
        .where(sql`${couplings.organizationId} = ${org.id} AND ${couplings.isActive} = true`);

      const [membersRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.organizationId, org.id));

      // Recherche de l'admin principal
      const [adminUser] = await db
        .select()
        .from(users)
        .where(sql`${users.organizationId} = ${org.id} AND ${users.role} = 'ORG_ADMIN'`)
        .limit(1);

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        subscriptionStatus: org.subscriptionStatus as 'active' | 'suspended',
        createdAt: org.createdAt.toISOString(),
        stats: {
          tractorsCount: tractorsRes?.count ?? 0,
          trailersCount: trailersRes?.count ?? 0,
          activeCouplingsCount: couplingsRes?.count ?? 0,
          membersCount: membersRes?.count ?? 0,
        },
        admin: adminUser
          ? {
              id: adminUser.id,
              name: `${adminUser.firstName} ${adminUser.lastName}`,
              email: adminUser.email,
              phone: adminUser.phone,
            }
          : null,
      };
    })
  );

  // Calcul des KPIs globaux
  const activeOrgsCount = orgsWithStats.filter((o) => o.subscriptionStatus === 'active').length;
  const totalFleetCount = orgsWithStats.reduce(
    (acc, o) => acc + (o.stats.tractorsCount + o.stats.trailersCount),
    0
  );
  const totalUsersCount = orgsWithStats.reduce((acc, o) => acc + o.stats.membersCount, 0);

  return c.json({
    organizations: orgsWithStats,
    kpis: {
      activeOrgsCount,
      totalFleetCount,
      totalUsersCount,
    },
  });
});

/**
 * Crée une nouvelle organisation avec ses équipes et son administrateur initial
 */
organizationsRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.name) {
    return c.json({ error: 'Le nom de l’organisation est obligatoire' }, 400);
  }

  const name = String(body.name).trim();
  const rawSlug = body.slug
    ? String(body.slug).trim()
    : name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

  const slug = `${rawSlug}-${Date.now().toString(36)}`;

  // 1. Création de l'organisation
  const [newOrg] = await db
    .insert(organizations)
    .values({
      name,
      slug,
      subscriptionStatus: 'active',
    })
    .returning();

  // 2. Création des 3 équipes par défaut
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

  for (const conf of teamConfigs) {
    const [insertedTeam] = await db
      .insert(teams)
      .values({
        organizationId: newOrg.id,
        name: conf.name,
        description: conf.description,
      })
      .returning();

    for (const cap of conf.capabilities) {
      await db.insert(teamCapabilities).values({
        teamId: insertedTeam.id,
        capability: cap,
      });
    }

    for (const [key, val] of Object.entries(conf.preferences)) {
      await db.insert(teamPreferences).values({
        teamId: insertedTeam.id,
        preferenceKey: key,
        preferenceValue: val,
      });
    }
  }

  // 3. Catégories de pannes & Sujets de maintenance par défaut (Référentiel complet)
  for (const item of DEFAULT_INCIDENT_CATALOG) {
    await db.insert(breakdownCategories).values({
      organizationId: newOrg.id,
      name: item.name,
      code: item.code,
      severity: item.severity,
      categoryType: item.categoryType,
      description: item.description,
    });
  }

  const defaultGarages = [
    { name: 'Atelier Central', location: 'Zone Industrielle', contactPhone: '+221338000001' },
  ];

  for (const gar of defaultGarages) {
    await db.insert(garages).values({
      organizationId: newOrg.id,
      name: gar.name,
      location: gar.location,
      contactPhone: gar.contactPhone,
    });
  }

  // 4. Création optionnelle d'un administrateur initial
  if (body.admin?.phone) {
    const normPhone = normalizePhone(String(body.admin.phone));
    const pin = body.admin.pin ? String(body.admin.pin).trim() : '1234';

    await db.insert(users).values({
      organizationId: newOrg.id,
      phone: normPhone,
      email: body.admin.email ? String(body.admin.email).trim() : null,
      pinHash: hashPin(pin),
      firstName: body.admin.firstName ? String(body.admin.firstName).trim() : 'Admin',
      lastName: body.admin.lastName ? String(body.admin.lastName).trim() : name,
      role: 'ORG_ADMIN',
      status: 'active',
    });
  }

  const orgDto: OrganizationDTO = {
    id: newOrg.id,
    name: newOrg.name,
    slug: newOrg.slug,
    subscriptionStatus: newOrg.subscriptionStatus as 'active' | 'suspended',
    createdAt: newOrg.createdAt.toISOString(),
  };

  return c.json(orgDto, 201);
});

/**
 * Modifie le nom ou le statut d'abonnement d'une organisation
 */
organizationsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Corps de requête manquant' }, 400);
  }

  const updateFields: { name?: string; subscriptionStatus?: string } = {};
  if (body.name) updateFields.name = String(body.name).trim();
  if (body.subscriptionStatus && ['active', 'suspended'].includes(body.subscriptionStatus)) {
    updateFields.subscriptionStatus = body.subscriptionStatus;
  }

  const [updated] = await db
    .update(organizations)
    .set(updateFields)
    .where(eq(organizations.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: 'Organisation introuvable' }, 404);
  }

  return c.json({
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    subscriptionStatus: updated.subscriptionStatus,
    createdAt: updated.createdAt.toISOString(),
  });
});
