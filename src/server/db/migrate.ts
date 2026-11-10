import { pool } from './index.js';

/**
 * Exécute l'initialisation idempotente du schéma PostgreSQL.
 * Crée les extensions, tables et index si nécessaires.
 */
export async function ensureSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // S'assurer de la présence du générateur UUID
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // 1. ORGANIZATIONS
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        subscription_status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. TEAMS
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS teams_org_name_unique_idx 
        ON teams(organization_id, name);
    `);

    // 3. TEAM CAPABILITIES
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_capabilities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        capability TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS team_capabilities_team_cap_unique_idx 
        ON team_capabilities(team_id, capability);
    `);

    // 4. TEAM PREFERENCES
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        preference_key TEXT NOT NULL,
        preference_value TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS team_preferences_team_key_unique_idx 
        ON team_preferences(team_id, preference_key);
    `);

    // 5. USERS
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
        phone TEXT UNIQUE NOT NULL,
        email TEXT,
        pin_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'MEMBER',
        status TEXT NOT NULL DEFAULT 'active',
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 6. SESSIONS
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        active_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 7. TRACTORS
    await client.query(`
      CREATE TABLE IF NOT EXISTS tractors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        plate_number TEXT NOT NULL,
        brand_model TEXT,
        status TEXT NOT NULL DEFAULT 'in_service',
        mileage_km INTEGER NOT NULL DEFAULT 0,
        next_oil_change_km INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS tractors_org_plate_unique_idx 
        ON tractors(organization_id, plate_number);
    `);

    // 8. TRAILERS
    await client.query(`
      CREATE TABLE IF NOT EXISTS trailers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        plate_number TEXT NOT NULL,
        trailer_type TEXT NOT NULL DEFAULT 'BENNE',
        status TEXT NOT NULL DEFAULT 'in_service',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS trailers_org_plate_unique_idx 
        ON trailers(organization_id, plate_number);
    `);

    // 9. COUPLINGS
    await client.query(`
      CREATE TABLE IF NOT EXISTS couplings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        order_number TEXT NOT NULL,
        tractor_id UUID NOT NULL REFERENCES tractors(id) ON DELETE CASCADE,
        trailer_id UUID NOT NULL REFERENCES trailers(id) ON DELETE CASCADE,
        driver_name TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        coupled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        uncoupled_at TIMESTAMPTZ,
        created_by_id UUID REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // 10. BREAKDOWN CATEGORIES
    await client.query(`
      CREATE TABLE IF NOT EXISTS breakdown_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'high'
      );
    `);

    // 11. GARAGES
    await client.query(`
      CREATE TABLE IF NOT EXISTS garages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        location TEXT,
        contact_phone TEXT
      );
    `);

    await client.query('COMMIT');
    console.log('✅ Schéma PostgreSQL vérifié et à jour.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de l’initialisation du schéma PostgreSQL :', err);
    throw err;
  } finally {
    client.release();
  }
}
