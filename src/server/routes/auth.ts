import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { sessions, users, organizations } from '../db/schema.js';
import { normalizePhone, getPhoneVariants, verifyPin } from '../auth/pin.js';
import {
  authMiddleware,
  loadUserWithPolicy,
  requireSuperAdmin,
  type AuthContextVariables,
} from '../auth/middleware.js';
import type { OrganizationDTO } from '../../shared/types.js';

export const authRouter = new Hono<{ Variables: AuthContextVariables }>();

/**
 * Comptes de démonstration pour la connexion rapide en 1-clic
 */
authRouter.get('/demo-accounts', (c) => {
  return c.json([
    {
      role: 'SUPER_ADMIN',
      name: 'Sylvain SuperAdmin (Local)',
      phone: '+221 77 000 00 00',
      rawPhone: '+221770000000',
      organization: 'Toutes les organisations',
      badge: 'SUPER ADMIN [LOCAL]',
      pin: '1234',
    },
    {
      role: 'ORG_ADMIN',
      name: 'Mamadou Ba',
      phone: '+221 77 123 45 67',
      rawPhone: '+221771234567',
      organization: 'SAHEL TRANS EXPRESS (LOCAL)',
      badge: 'ADMIN SAHEL [LOCAL]',
      pin: '1234',
    },
    {
      role: 'ORG_ADMIN',
      name: 'Ousmane Cissé',
      phone: '+221 77 222 33 44',
      rawPhone: '+221772223344',
      organization: 'DAKAR LOGISTICS MOCK (LOCAL)',
      badge: 'ADMIN DAKAR LOG [LOCAL]',
      pin: '1234',
    },
    {
      role: 'MEMBER',
      name: 'Fatou Sow',
      phone: '+221 78 987 65 43',
      rawPhone: '+221789876543',
      organization: 'SAHEL TRANS EXPRESS (LOCAL)',
      badge: 'TERRAIN SAHEL [LOCAL]',
      pin: '1234',
    },
  ]);
});

/**
 * Connexion par Téléphone + Code PIN (4 chiffres)
 */
authRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.phone || !body.pin) {
    return c.json({ error: 'Téléphone et code PIN obligatoires' }, 400);
  }

  const phoneVariants = getPhoneVariants(String(body.phone));
  const pin = String(body.pin).trim();

  // Recherche de l'utilisateur par l'une des variantes du numéro (national ou avec indicatif)
  const [userRecord] = await db
    .select()
    .from(users)
    .where(inArray(users.phone, phoneVariants))
    .limit(1);

  if (!userRecord) {
    return c.json({ error: 'Identifiants invalides (numéro inconnu)' }, 401);
  }

  if (userRecord.status !== 'active') {
    return c.json({ error: 'Votre compte est inactif ou suspendu' }, 403);
  }

  // Vérification du PIN
  const isPinValid = verifyPin(pin, userRecord.pinHash);
  if (!isPinValid) {
    return c.json({ error: 'Code PIN incorrect' }, 401);
  }

  // Mise à jour de la dernière connexion
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userRecord.id));

  // Détermination de l'organisation active pour la session
  let activeOrgId: string | null = userRecord.organizationId;
  if (!activeOrgId && userRecord.role === 'SUPER_ADMIN') {
    const [firstOrg] = await db.select({ id: organizations.id }).from(organizations).limit(1);
    activeOrgId = firstOrg?.id ?? null;
  }

  // Création du token de session (30 jours)
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: token,
    userId: userRecord.id,
    activeOrganizationId: activeOrgId,
    expiresAt,
  });

  // Pose du cookie sécurisé
  setCookie(c, 'logicam_session', token, {
    path: '/',
    httpOnly: true,
    maxAge: 30 * 24 * 3600,
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
  });

  // Chargement du profil complet
  const user = await loadUserWithPolicy(userRecord.id);

  // Chargement des organisations
  let orgList: OrganizationDTO[] = [];
  let currentOrg: OrganizationDTO | null = null;

  if (userRecord.role === 'SUPER_ADMIN') {
    const allOrgs = await db.select().from(organizations);
    orgList = allOrgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      subscriptionStatus: o.subscriptionStatus as 'active' | 'suspended',
      createdAt: o.createdAt.toISOString(),
    }));
    currentOrg = orgList.find((o) => o.id === activeOrgId) || orgList[0] || null;
  } else if (activeOrgId) {
    const [found] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, activeOrgId))
      .limit(1);
    if (found) {
      currentOrg = {
        id: found.id,
        name: found.name,
        slug: found.slug,
        subscriptionStatus: found.subscriptionStatus as 'active' | 'suspended',
        createdAt: found.createdAt.toISOString(),
      };
      orgList = [currentOrg];
    }
  }

  return c.json({
    token,
    user,
    currentOrganization: currentOrg,
    organizations: orgList,
  });
});

/**
 * Déconnexion de la session courante
 */
authRouter.post('/logout', async (c) => {
  const authHeader = c.req.header('authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) {
    token = getCookie(c, 'logicam_session');
  }

  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
  }

  deleteCookie(c, 'logicam_session', { path: '/' });
  return c.json({ success: true });
});

/**
 * Profil de l'utilisateur connecté
 */
authRouter.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  const effectiveOrgId = c.get('effectiveOrgId');

  let orgList: OrganizationDTO[] = [];
  let currentOrg: OrganizationDTO | null = null;

  if (user.role === 'SUPER_ADMIN') {
    const allOrgs = await db.select().from(organizations);
    orgList = allOrgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      subscriptionStatus: o.subscriptionStatus as 'active' | 'suspended',
      createdAt: o.createdAt.toISOString(),
    }));
    currentOrg = orgList.find((o) => o.id === effectiveOrgId) || orgList[0] || null;
  } else if (effectiveOrgId) {
    const [found] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, effectiveOrgId))
      .limit(1);
    if (found) {
      currentOrg = {
        id: found.id,
        name: found.name,
        slug: found.slug,
        subscriptionStatus: found.subscriptionStatus as 'active' | 'suspended',
        createdAt: found.createdAt.toISOString(),
      };
      orgList = [currentOrg];
    }
  }

  return c.json({
    user,
    currentOrganization: currentOrg,
    organizations: orgList,
  });
});

/**
 * Bascule d'organisation active (réservé au Super Admin)
 */
authRouter.post('/switch-org', authMiddleware, requireSuperAdmin(), async (c) => {
  const body = await c.req.json().catch(() => null);
  const organizationId = body?.organizationId;

  if (!organizationId) {
    return c.json({ error: 'Identifiant d’organisation requis' }, 400);
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    return c.json({ error: 'Organisation introuvable' }, 404);
  }

  const sessionId = c.get('sessionId');
  await db
    .update(sessions)
    .set({ activeOrganizationId: org.id })
    .where(eq(sessions.id, sessionId));

  const currentOrganization: OrganizationDTO = {
    id: org.id,
    name: org.name,
    slug: org.slug,
    subscriptionStatus: org.subscriptionStatus as 'active' | 'suspended',
    createdAt: org.createdAt.toISOString(),
  };

  return c.json({
    success: true,
    currentOrganization,
  });
});
