import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sessions, users, teams, teamCapabilities, teamPreferences, organizations } from '../db/schema.js';
import type { Capability, UserDTO, UserRole } from '../../shared/types.js';
import { hasCapability } from '../../shared/permissions.js';

export interface AuthContextVariables {
  user: UserDTO;
  sessionId: string;
  effectiveOrgId: string;
}

/**
 * Charge un utilisateur avec son équipe, ses capabilities et ses préférences
 */
export async function loadUserWithPolicy(userId: string): Promise<UserDTO | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  let team = null;
  let capabilities: Capability[] = [];
  const preferences: Record<string, string> = {};

  if (user.teamId) {
    const [t] = await db.select().from(teams).where(eq(teams.id, user.teamId)).limit(1);
    if (t) {
      team = {
        id: t.id,
        organizationId: t.organizationId,
        name: t.name,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      };

      const caps = await db.select().from(teamCapabilities).where(eq(teamCapabilities.teamId, t.id));
      capabilities = caps.map((c) => c.capability as Capability);

      const prefs = await db.select().from(teamPreferences).where(eq(teamPreferences.teamId, t.id));
      for (const p of prefs) {
        preferences[p.preferenceKey] = p.preferenceValue;
      }
    }
  }

  return {
    id: user.id,
    organizationId: user.organizationId,
    teamId: user.teamId,
    phone: user.phone,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as UserRole,
    status: user.status as 'active' | 'inactive',
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    team,
    capabilities,
    preferences,
  };
}

/**
 * Middleware d'authentification par session token (Bearer ou cookie)
 * et de résolution multi-tenant stricte.
 */
export async function authMiddleware(
  c: Context<{ Variables: AuthContextVariables }>,
  next: Next
): Promise<Response | void> {
  // 1. Extraction du token
  const authHeader = c.req.header('authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) {
    token = getCookie(c, 'logicam_session');
  }

  if (!token) {
    return c.json({ error: 'Non authentifié : token manquant' }, 401);
  }

  // 2. Recherche de la session active
  const now = new Date();
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!session) {
    return c.json({ error: 'Session invalide ou expirée' }, 401);
  }

  // 3. Chargement de l'utilisateur
  const user = await loadUserWithPolicy(session.userId);
  if (!user || user.status !== 'active') {
    return c.json({ error: 'Compte inactif ou introuvable' }, 403);
  }

  // 4. Résolution de l'organisation effective
  let effectiveOrgId = '';

  if (user.role === 'SUPER_ADMIN') {
    const headerOrgId = c.req.header('x-organization-id');
    if (headerOrgId) {
      effectiveOrgId = headerOrgId;
    } else if (session.activeOrganizationId) {
      effectiveOrgId = session.activeOrganizationId;
    } else {
      const [firstOrg] = await db.select({ id: organizations.id }).from(organizations).limit(1);
      effectiveOrgId = firstOrg?.id ?? '';
    }
  } else {
    // Isolation multi-tenant stricte : un non-super admin ne peut JAMAIS accéder à une autre org
    effectiveOrgId = user.organizationId ?? '';
  }

  c.set('user', user);
  c.set('sessionId', session.id);
  c.set('effectiveOrgId', effectiveOrgId);

  await next();
}

/**
 * Garde d'autorisation basée sur les capabilities
 */
export function requireCapability(capability: Capability) {
  return async (c: Context<{ Variables: AuthContextVariables }>, next: Next): Promise<Response | void> => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Non authentifié' }, 401);
    }
    if (!hasCapability(user.role, user.capabilities, capability)) {
      return c.json({ error: `Accès refusé : permission '${capability}' requise` }, 403);
    }
    await next();
  };
}

/**
 * Garde d'autorisation réservée aux administrateurs généraux (SUPER_ADMIN)
 */
export function requireSuperAdmin() {
  return async (c: Context<{ Variables: AuthContextVariables }>, next: Next): Promise<Response | void> => {
    const user = c.get('user');
    if (!user || user.role !== 'SUPER_ADMIN') {
      return c.json({ error: 'Accès réservé aux administrateurs généraux (Super Admin)' }, 403);
    }
    await next();
  };
}

/**
 * Garde d'autorisation réservée aux administrateurs (SUPER_ADMIN ou ORG_ADMIN)
 */
export function requireOrgAdminOrSuper() {
  return async (c: Context<{ Variables: AuthContextVariables }>, next: Next): Promise<Response | void> => {
    const user = c.get('user');
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) {
      return c.json({ error: 'Accès réservé aux administrateurs' }, 403);
    }
    await next();
  };
}
