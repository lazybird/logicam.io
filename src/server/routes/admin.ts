import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  teams,
  teamCapabilities,
  teamPreferences,
  breakdownCategories,
  garages,
} from '../db/schema.js';
import { hashPin, normalizePhone } from '../auth/pin.js';
import {
  authMiddleware,
  requireCapability,
  type AuthContextVariables,
} from '../auth/middleware.js';
import { hasCapability } from '../../shared/permissions.js';
import type { Capability, TeamDTO, UserRole } from '../../shared/types.js';

export const adminRouter = new Hono<{ Variables: AuthContextVariables }>();

// Protège toutes les routes d'administration
adminRouter.use('*', authMiddleware);

/**
 * Vue globale d'administration pour l'organisation active
 */
adminRouter.get('/overview', requireCapability('members:read'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');

  if (!effectiveOrgId) {
    return c.json({ error: 'Aucune organisation active' }, 400);
  }

  // 1. Liste des membres
  const memberRows = await db
    .select({
      id: users.id,
      organizationId: users.organizationId,
      teamId: users.teamId,
      teamName: teams.name,
      phone: users.phone,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(teams, eq(users.teamId, teams.id))
    .where(eq(users.organizationId, effectiveOrgId));

  const members = memberRows.map((m) => ({
    id: m.id,
    organizationId: m.organizationId,
    teamId: m.teamId,
    teamName: m.teamName,
    phone: m.phone,
    email: m.email,
    firstName: m.firstName,
    lastName: m.lastName,
    role: m.role as UserRole,
    status: m.status as 'active' | 'inactive',
    lastLoginAt: m.lastLoginAt ? m.lastLoginAt.toISOString() : null,
    createdAt: m.createdAt.toISOString(),
  }));

  // 2. Liste des équipes avec capabilities et préférences
  const orgTeams = await db
    .select()
    .from(teams)
    .where(eq(teams.organizationId, effectiveOrgId));

  const teamsDTO: TeamDTO[] = await Promise.all(
    orgTeams.map(async (t) => {
      const caps = await db
        .select()
        .from(teamCapabilities)
        .where(eq(teamCapabilities.teamId, t.id));

      const prefs = await db
        .select()
        .from(teamPreferences)
        .where(eq(teamPreferences.teamId, t.id));

      const [membersCountRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.teamId, t.id));

      const prefObj: Record<string, string> = {};
      for (const p of prefs) {
        prefObj[p.preferenceKey] = p.preferenceValue;
      }

      return {
        id: t.id,
        organizationId: t.organizationId,
        name: t.name,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
        capabilities: caps.map((c) => c.capability as Capability),
        preferences: prefObj,
        membersCount: membersCountRes?.count ?? 0,
      };
    })
  );

  // 3. Catégories de pannes
  const categories = await db
    .select()
    .from(breakdownCategories)
    .where(eq(breakdownCategories.organizationId, effectiveOrgId));

  // 4. Garages partenaires
  const partnerGarages = await db
    .select()
    .from(garages)
    .where(eq(garages.organizationId, effectiveOrgId));

  return c.json({
    members,
    teams: teamsDTO,
    breakdownCategories: categories,
    garages: partnerGarages,
  });
});

/**
 * Création d'un membre utilisateur
 */
adminRouter.post('/members', requireCapability('members:manage'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const body = await c.req.json().catch(() => null);

  if (!body || !body.firstName || !body.lastName || !body.phone) {
    return c.json({ error: 'Prénom, nom et numéro de téléphone obligatoires' }, 400);
  }

  const phone = normalizePhone(String(body.phone));
  const pin = body.pin ? String(body.pin).trim() : '1234';

  // Vérifier l'unicité du téléphone
  const [existing] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (existing) {
    return c.json({ error: 'Ce numéro de téléphone est déjà utilisé' }, 400);
  }

  const [inserted] = await db
    .insert(users)
    .values({
      organizationId: effectiveOrgId,
      teamId: body.teamId || null,
      phone,
      email: body.email ? String(body.email).trim() : null,
      pinHash: hashPin(pin),
      firstName: String(body.firstName).trim(),
      lastName: String(body.lastName).trim(),
      role: (body.role as UserRole) || 'MEMBER',
      status: 'active',
    })
    .returning();

  return c.json(
    {
      id: inserted.id,
      organizationId: inserted.organizationId,
      teamId: inserted.teamId,
      phone: inserted.phone,
      email: inserted.email,
      firstName: inserted.firstName,
      lastName: inserted.lastName,
      role: inserted.role,
      status: inserted.status,
      lastLoginAt: null,
      createdAt: inserted.createdAt.toISOString(),
    },
    201
  );
});

/**
 * Modification d'un membre utilisateur (rôle, équipe, statut, ou reset PIN)
 */
adminRouter.patch('/members/:id', requireCapability('members:manage'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const id = c.req.param('id');
  if (!id) {
    return c.json({ error: 'ID membre requis' }, 400);
  }
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Données requises' }, 400);
  }

  const updateData: {
    firstName?: string;
    lastName?: string;
    role?: string;
    teamId?: string | null;
    status?: string;
    pinHash?: string;
  } = {};

  if (body.firstName) updateData.firstName = String(body.firstName).trim();
  if (body.lastName) updateData.lastName = String(body.lastName).trim();
  if (body.role && ['ORG_ADMIN', 'MEMBER'].includes(body.role)) updateData.role = body.role;
  if (body.teamId !== undefined) updateData.teamId = body.teamId;
  if (body.status && ['active', 'inactive'].includes(body.status)) updateData.status = body.status;
  if (body.pin) updateData.pinHash = hashPin(String(body.pin).trim());

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(and(eq(users.id, id), eq(users.organizationId, effectiveOrgId)))
    .returning();

  if (!updated) {
    return c.json({ error: 'Utilisateur introuvable dans cette organisation' }, 404);
  }

  return c.json({
    id: updated.id,
    organizationId: updated.organizationId,
    teamId: updated.teamId,
    phone: updated.phone,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    role: updated.role,
    status: updated.status,
    lastLoginAt: updated.lastLoginAt ? updated.lastLoginAt.toISOString() : null,
    createdAt: updated.createdAt.toISOString(),
  });
});

/**
 * Création d'une nouvelle équipe
 */
adminRouter.post('/teams', requireCapability('members:manage'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const body = await c.req.json().catch(() => null);

  if (!body || !body.name) {
    return c.json({ error: 'Le nom de l’équipe est obligatoire' }, 400);
  }

  const [newTeam] = await db
    .insert(teams)
    .values({
      organizationId: effectiveOrgId,
      name: String(body.name).trim(),
      description: body.description ? String(body.description).trim() : null,
    })
    .returning();

  const capabilities: Capability[] = Array.isArray(body.capabilities) ? body.capabilities : [];
  for (const cap of capabilities) {
    await db.insert(teamCapabilities).values({
      teamId: newTeam.id,
      capability: cap,
    });
  }

  const preferences: Record<string, string> =
    body.preferences && typeof body.preferences === 'object' ? body.preferences : {};
  for (const [key, val] of Object.entries(preferences)) {
    await db.insert(teamPreferences).values({
      teamId: newTeam.id,
      preferenceKey: key,
      preferenceValue: String(val),
    });
  }

  return c.json(
    {
      id: newTeam.id,
      organizationId: newTeam.organizationId,
      name: newTeam.name,
      description: newTeam.description,
      createdAt: newTeam.createdAt.toISOString(),
      capabilities,
      preferences,
      membersCount: 0,
    },
    201
  );
});

/**
 * Mise à jour de la politique de permissions et préférences d'une équipe
 */
adminRouter.put('/teams/:id/policy', requireCapability('members:manage'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const teamId = c.req.param('id');
  if (!teamId) {
    return c.json({ error: 'ID équipe requis' }, 400);
  }
  const body = await c.req.json().catch(() => null);

  if (!body) {
    return c.json({ error: 'Données requises' }, 400);
  }

  // Vérifier que l'équipe appartient à l'organisation
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.organizationId, effectiveOrgId)))
    .limit(1);

  if (!team) {
    return c.json({ error: 'Équipe introuvable' }, 404);
  }

  // 1. Mise à jour des capabilities
  if (Array.isArray(body.capabilities)) {
    await db.delete(teamCapabilities).where(eq(teamCapabilities.teamId, team.id));
    for (const cap of body.capabilities) {
      await db.insert(teamCapabilities).values({
        teamId: team.id,
        capability: cap,
      });
    }
  }

  // 2. Mise à jour des préférences
  if (body.preferences && typeof body.preferences === 'object') {
    await db.delete(teamPreferences).where(eq(teamPreferences.teamId, team.id));
    for (const [key, val] of Object.entries(body.preferences)) {
      await db.insert(teamPreferences).values({
        teamId: team.id,
        preferenceKey: key,
        preferenceValue: String(val),
      });
    }
  }

  return c.json({ success: true });
});

/**
 * Création d'une catégorie de panne ou sujet de maintenance
 * Accessible aux gestionnaires via 'settings:manage' OU 'incidents:create' (création rapide à la volée)
 */
adminRouter.post('/categories', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Non authentifié' }, 401);
  }

  const hasPermission =
    user.role === 'SUPER_ADMIN' ||
    user.role === 'ORG_ADMIN' ||
    hasCapability(user.role, user.capabilities, 'settings:manage') ||
    hasCapability(user.role, user.capabilities, 'incidents:create');

  if (!hasPermission) {
    return c.json({ error: 'Permission refusée (incidents:create ou settings:manage requis)' }, 403);
  }

  const effectiveOrgId = c.get('effectiveOrgId');
  const body = await c.req.json().catch(() => null);

  if (!body || !body.name) {
    return c.json({ error: 'Nom de la catégorie ou du sujet requis' }, 400);
  }

  const name = String(body.name).trim();
  const rawCode = body.code
    ? String(body.code).trim().toUpperCase()
    : name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .slice(0, 30);

  const categoryType = body.categoryType === 'maintenance' ? 'maintenance' : 'breakdown';
  const severity = body.severity || (categoryType === 'maintenance' ? 'medium' : 'high');
  const description = body.description ? String(body.description).trim() : null;

  const [inserted] = await db
    .insert(breakdownCategories)
    .values({
      organizationId: effectiveOrgId,
      name,
      code: rawCode,
      severity,
      categoryType,
      description,
    })
    .returning();

  return c.json(inserted, 201);
});

/**
 * Suppression d'une catégorie de panne
 */
adminRouter.delete('/categories/:id', requireCapability('settings:manage'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const id = c.req.param('id');
  if (!id) {
    return c.json({ error: 'ID requis' }, 400);
  }

  await db
    .delete(breakdownCategories)
    .where(
      and(
        eq(breakdownCategories.id, id),
        eq(breakdownCategories.organizationId, effectiveOrgId)
      )
    );

  return c.json({ success: true });
});

/**
 * Création d'un garage
 */
adminRouter.post('/garages', requireCapability('settings:manage'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const body = await c.req.json().catch(() => null);

  if (!body || !body.name) {
    return c.json({ error: 'Nom du garage obligatoire' }, 400);
  }

  const [inserted] = await db
    .insert(garages)
    .values({
      organizationId: effectiveOrgId,
      name: String(body.name).trim(),
      location: body.location ? String(body.location).trim() : null,
      contactPhone: body.contactPhone ? String(body.contactPhone).trim() : null,
    })
    .returning();

  return c.json(inserted, 201);
});

/**
 * Suppression d'un garage
 */
adminRouter.delete('/garages/:id', requireCapability('settings:manage'), async (c) => {
  const effectiveOrgId = c.get('effectiveOrgId');
  const id = c.req.param('id');
  if (!id) {
    return c.json({ error: 'ID requis' }, 400);
  }

  await db
    .delete(garages)
    .where(and(eq(garages.id, id), eq(garages.organizationId, effectiveOrgId)));

  return c.json({ success: true });
});
