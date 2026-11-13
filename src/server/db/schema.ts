import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// -------------------------------------------------------------
// ORGANISATIONS
// -------------------------------------------------------------
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  subscriptionStatus: text('subscription_status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  teams: many(teams),
  users: many(users),
  tractors: many(tractors),
  trailers: many(trailers),
  couplings: many(couplings),
  breakdownCategories: many(breakdownCategories),
  garages: many(garages),
  incidents: many(incidents),
}));

// -------------------------------------------------------------
// ÉQUIPES (TEAMS)
// -------------------------------------------------------------
export const teams = pgTable(
  'teams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('teams_org_name_unique_idx').on(table.organizationId, table.name),
  ]
);

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  capabilities: many(teamCapabilities),
  preferences: many(teamPreferences),
  members: many(users),
}));

// -------------------------------------------------------------
// CAPABILITIES D'ÉQUIPES
// -------------------------------------------------------------
export const teamCapabilities = pgTable(
  'team_capabilities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    capability: text('capability').notNull(),
  },
  (table) => [
    uniqueIndex('team_capabilities_team_cap_unique_idx').on(table.teamId, table.capability),
  ]
);

export const teamCapabilitiesRelations = relations(teamCapabilities, ({ one }) => ({
  team: one(teams, {
    fields: [teamCapabilities.teamId],
    references: [teams.id],
  }),
}));

// -------------------------------------------------------------
// PRÉFÉRENCES D'ÉQUIPES
// -------------------------------------------------------------
export const teamPreferences = pgTable(
  'team_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    preferenceKey: text('preference_key').notNull(),
    preferenceValue: text('preference_value').notNull(),
  },
  (table) => [
    uniqueIndex('team_preferences_team_key_unique_idx').on(table.teamId, table.preferenceKey),
  ]
);

export const teamPreferencesRelations = relations(teamPreferences, ({ one }) => ({
  team: one(teams, {
    fields: [teamPreferences.teamId],
    references: [teams.id],
  }),
}));

// -------------------------------------------------------------
// UTILISATEURS (USERS)
// -------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, {
    onDelete: 'cascade',
  }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  phone: text('phone').notNull().unique(),
  email: text('email'),
  pinHash: text('pin_hash').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  role: text('role').notNull().default('MEMBER'), // 'SUPER_ADMIN' | 'ORG_ADMIN' | 'MEMBER'
  status: text('status').notNull().default('active'), // 'active' | 'inactive'
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  team: one(teams, {
    fields: [users.teamId],
    references: [teams.id],
  }),
  sessions: many(sessions),
}));

// -------------------------------------------------------------
// SESSIONS
// -------------------------------------------------------------
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  activeOrganizationId: uuid('active_organization_id').references(() => organizations.id, {
    onDelete: 'set null',
  }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  activeOrganization: one(organizations, {
    fields: [sessions.activeOrganizationId],
    references: [organizations.id],
  }),
}));

// -------------------------------------------------------------
// TRACTEURS (TRACTORS)
// -------------------------------------------------------------
export const tractors = pgTable(
  'tractors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    plateNumber: text('plate_number').notNull(),
    brandModel: text('brand_model'),
    status: text('status').notNull().default('in_service'), // 'in_service' | 'breakdown' | 'maintenance'
    mileageKm: integer('mileage_km').notNull().default(0),
    nextOilChangeKm: integer('next_oil_change_km'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('tractors_org_plate_unique_idx').on(table.organizationId, table.plateNumber),
  ]
);

export const tractorsRelations = relations(tractors, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tractors.organizationId],
    references: [organizations.id],
  }),
  couplings: many(couplings),
}));

// -------------------------------------------------------------
// REMORQUES (TRAILERS)
// -------------------------------------------------------------
export const trailers = pgTable(
  'trailers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    plateNumber: text('plate_number').notNull(),
    trailerType: text('trailer_type').notNull().default('BENNE'), // 'BENNE' | 'PLATEAU' | 'CITERNE' | 'FRIGO' | 'AUTRE'
    status: text('status').notNull().default('in_service'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('trailers_org_plate_unique_idx').on(table.organizationId, table.plateNumber),
  ]
);

export const trailersRelations = relations(trailers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [trailers.organizationId],
    references: [organizations.id],
  }),
  couplings: many(couplings),
}));

// -------------------------------------------------------------
// ATTELAGES & HISTORIQUE (COUPLINGS)
// -------------------------------------------------------------
export const couplings = pgTable('couplings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  orderNumber: text('order_number').notNull(),
  tractorId: uuid('tractor_id')
    .notNull()
    .references(() => tractors.id, { onDelete: 'cascade' }),
  trailerId: uuid('trailer_id')
    .notNull()
    .references(() => trailers.id, { onDelete: 'cascade' }),
  driverName: text('driver_name'),
  isActive: boolean('is_active').notNull().default(true),
  coupledAt: timestamp('coupled_at', { withTimezone: true }).defaultNow().notNull(),
  uncoupledAt: timestamp('uncoupled_at', { withTimezone: true }),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
});

export const couplingsRelations = relations(couplings, ({ one }) => ({
  organization: one(organizations, {
    fields: [couplings.organizationId],
    references: [organizations.id],
  }),
  tractor: one(tractors, {
    fields: [couplings.tractorId],
    references: [tractors.id],
  }),
  trailer: one(trailers, {
    fields: [couplings.trailerId],
    references: [trailers.id],
  }),
  createdBy: one(users, {
    fields: [couplings.createdById],
    references: [users.id],
  }),
}));

// -------------------------------------------------------------
// CATÉGORIES DE PANNES (BREAKDOWN CATEGORIES)
// -------------------------------------------------------------
export const breakdownCategories = pgTable('breakdown_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  severity: text('severity').notNull().default('high'),
});

export const breakdownCategoriesRelations = relations(breakdownCategories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [breakdownCategories.organizationId],
    references: [organizations.id],
  }),
  incidents: many(incidents),
}));

// -------------------------------------------------------------
// INCIDENTS / PANNES & MAINTENANCES (INCIDENTS)
// -------------------------------------------------------------
export const incidents = pgTable('incidents', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('breakdown'), // 'breakdown' | 'maintenance'
  tractorId: uuid('tractor_id').references(() => tractors.id, { onDelete: 'cascade' }),
  trailerId: uuid('trailer_id').references(() => trailers.id, { onDelete: 'cascade' }),
  couplingId: uuid('coupling_id').references(() => couplings.id, { onDelete: 'set null' }),
  categoryId: uuid('category_id').references(() => breakdownCategories.id, { onDelete: 'set null' }),
  garageId: uuid('garage_id').references(() => garages.id, { onDelete: 'set null' }),
  reportedById: uuid('reported_by_id').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes'),
  status: text('status').notNull().default('open'), // 'open' | 'resolved'
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const incidentsRelations = relations(incidents, ({ one }) => ({
  organization: one(organizations, {
    fields: [incidents.organizationId],
    references: [organizations.id],
  }),
  tractor: one(tractors, {
    fields: [incidents.tractorId],
    references: [tractors.id],
  }),
  trailer: one(trailers, {
    fields: [incidents.trailerId],
    references: [trailers.id],
  }),
  coupling: one(couplings, {
    fields: [incidents.couplingId],
    references: [couplings.id],
  }),
  category: one(breakdownCategories, {
    fields: [incidents.categoryId],
    references: [breakdownCategories.id],
  }),
  garage: one(garages, {
    fields: [incidents.garageId],
    references: [garages.id],
  }),
  reportedBy: one(users, {
    fields: [incidents.reportedById],
    references: [users.id],
  }),
}));

// -------------------------------------------------------------
// GARAGES / ATELIERS (GARAGES)
// -------------------------------------------------------------
export const garages = pgTable('garages', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  location: text('location'),
  contactPhone: text('contact_phone'),
});

export const garagesRelations = relations(garages, ({ one }) => ({
  organization: one(organizations, {
    fields: [garages.organizationId],
    references: [organizations.id],
  }),
}));
