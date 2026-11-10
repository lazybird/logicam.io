# LogiCam.io Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire et déployer la Phase 1 de LogiCam.io (Socle Fullstack Hono + Drizzle + React 19, Authentification Téléphone + PIN, Multi-Tenancy à 3 niveaux avec capabilities/preferences, Gestion du Parc Tracteurs/Remorques/Attelages, Import Excel des 146 ensembles, et déploiement continu sur Dokploy Pulsation via la branche `prod`).

**Architecture:** Application monolithique modulaire servie par Node.js 22 et Hono (port 3000) exposant des routes API typées (`/api/*`) connectées à un service PostgreSQL 16 dédié sur Dokploy via Drizzle ORM, et servant le frontend SPA React 19 (Vite + Tailwind CSS `LogiCam Industrial OS`). L'isolation multi-tenant est garantie par un middleware serveur et le contexte d'organisation supporte le switch Super Admin.

**Tech Stack:** Node.js 22, TypeScript 5.8, Hono (`@hono/node-server`), Drizzle ORM (`drizzle-orm`, `pg`), React 19, Vite 6, Tailwind CSS 3.4, Lucide React, ExcelJS, Vitest (tests unitaires/intégration).

**Spec:** `docs/superpowers/specs/2026-11-10-logicam-phase1-design.md`

## Global Constraints

- **Serveur Dokploy Cible :** Exclusivement `dokploy-pulsation` (`https://deploy.pulsation.cloud`). Ne jamais utiliser `dokploy-malihub`.
- **Dépôt Git & Branches :** Remote `git@github.com:lazybird/logicam.io.git`. Commits réguliers sur `main`, et push sur `prod` pour déclencher l'auto-deploy Dokploy.
- **Design System :** Respect strict de `LogiCam Industrial OS` (`#0b1326` surface, `#ff8c00` primary-container, `#6366f1` secondary admin, `#4edea3` tertiary, `#ffb4ab` error, bordures `1px solid #334155`, polices `JetBrains Mono` et `Geist`).
- **Base de données :** PostgreSQL standard (pas de dépendance à Supabase Auth ou Supabase SDK).

---

## File Structure

```text
/home/sylvain/Dev/logicamio
├── .gitignore
├── .dockerignore
├── .env.example
├── Dockerfile
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── drizzle.config.ts
├── index.html
├── src/
│   ├── shared/
│   │   ├── types.ts                # Types partagés (Rôles, Capabilities, Preferences, DTOs)
│   │   └── permissions.ts          # Logique pure d'évaluation des permissions (testable front & back)
│   ├── server/
│   │   ├── index.ts                # Entrée serveur Hono (API + fichiers statiques dist/client + auto-init)
│   │   ├── app.ts                  # Routeur Hono principal exporté pour les tests
│   │   ├── db/
│   │   │   ├── index.ts            # Connexion Pool PostgreSQL + instance Drizzle
│   │   │   ├── schema.ts           # Tables Drizzle (organizations, teams, users, tractors, trailers, couplings...)
│   │   │   ├── migrate.ts          # Initialisation idempotente du schéma SQL (CREATE TABLE IF NOT EXISTS)
│   │   │   └── seed.ts             # Seed idempotent (Organisations WAL & SOYAK, équipes, comptes démo + import Excel)
│   │   ├── auth/
│   │   │   ├── pin.ts              # Normalisation téléphone + hachage/vérification PIN (crypto.scryptSync)
│   │   │   └── middleware.ts       # Middleware Hono (session cookie/token + résolution tenant actif)
│   │   ├── services/
│   │   │   └── excelImporter.ts    # Parseur ExcelJS pour LISTE DE CAMIONS.xlsx
│   │   └── routes/
│   │       ├── auth.ts             # POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me, POST /api/auth/switch-org
│   │       ├── organizations.ts    # GET/POST/PATCH /api/organizations (Super Admin)
│   │       ├── fleet.ts            # GET /api/fleet, POST /api/fleet/tractors, /trailers, /couple, /uncouple, /import
│   │       └── admin.ts            # GET/POST/PATCH /api/admin/members, /teams, /categories, /garages
│   └── client/
│       ├── main.tsx                # Entrée React 19
│       ├── App.tsx                 # Gestionnaire de session, contexte multi-tenant et routage des vues
│       ├── index.css               # Directives Tailwind + styles industriels (scrollbars, focus orange)
│       ├── lib/
│       │   └── api.ts              # Client HTTP typé avec gestion du header X-Organization-Id
│       ├── context/
│       │   └── AuthContext.tsx     # État utilisateur, organisation active, hook useTeamPolicy()
│       ├── components/
│       │   ├── Layout.tsx          # TopNavBar + SideNavBar + BottomNavBar mobile (LogiCam Industrial OS)
│       │   ├── PinKeypad.tsx       # Pavé numérique industriel et afficheur 4 points
│       │   └── CouplingModal.tsx   # Modale de création/modification d'attelage ou véhicule
│       └── pages/
│           ├── LoginPage.tsx       # Écran connexion téléphone + PIN (fidèle à connexion_logicam.io_fr)
│           ├── FleetDashboard.tsx  # Dashboard Opérateur : KPIs + État du Parc + Filtres + Import Excel
│           ├── SuperAdminOrgs.tsx  # Console Super Admin : Gestion des Transporteurs + KPIs globaux
│           └── OrgAdminPage.tsx    # Administration d'Organisation : Membres, Équipes/Droits, Catégories, Garages
└── tests/
    ├── pin-and-permissions.test.ts # Tests unitaires Auth PIN & Permissions multi-tenant
    └── excel-importer.test.ts      # Test d'extraction des 146 lignes de LISTE DE CAMIONS.xlsx
```

---

### Task 1: Initialisation du Projet, Configuration TypeScript/Vite/Tailwind & Utilitaires Auth/Permissions

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `src/shared/types.ts`
- Create: `src/shared/permissions.ts`
- Create: `src/server/auth/pin.ts`
- Test: `tests/pin-and-permissions.test.ts`

**Interfaces:**
- Consumes: Aucune (tâche fondatrice)
- Produces:
  - `src/shared/types.ts` : `UserRole`, `Capability`, `PreferenceKey`, `UserDTO`, `OrganizationDTO`, `CouplingRowDTO`, `FleetKpiDTO`
  - `src/shared/permissions.ts` : `hasCapability(role: UserRole, capabilities: string[], required: Capability): boolean`
  - `src/server/auth/pin.ts` : `normalizePhone(phone: string): string`, `hashPin(pin: string): string`, `verifyPin(pin: string, storedHash: string): boolean`

- [ ] **Step 1: Créer `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js` et `index.html`**

Créer `package.json` avec les dépendances nécessaires :
```json
{
  "name": "logicam-io",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"tsx watch src/server/index.ts\" \"vite\"",
    "build": "vite build && tsc -p tsconfig.server.json",
    "start": "node dist/server/server/index.js",
    "test": "vitest run",
    "db:seed": "tsx src/server/db/seed.ts"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.8",
    "@hono/zod-validator": "^0.4.3",
    "clsx": "^2.1.1",
    "dotenv": "^16.4.7",
    "drizzle-orm": "^0.39.3",
    "exceljs": "^4.4.0",
    "hono": "^4.7.2",
    "lucide-react": "^0.475.0",
    "pg": "^8.13.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^3.0.1",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/node": "^22.13.4",
    "@types/pg": "^8.11.11",
    "@types/react": "^19.0.8",
    "@types/react-dom": "^19.0.3",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "concurrently": "^9.1.2",
    "postcss": "^8.5.2",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.19.2",
    "typescript": "~5.7.3",
    "vite": "^6.1.0",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 2: Écrire le test unitaire `tests/pin-and-permissions.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { normalizePhone, hashPin, verifyPin } from '../src/server/auth/pin';
import { hasCapability } from '../src/shared/permissions';

describe('Auth PIN & Phone Normalization', () => {
  it('normalizes phone numbers consistently', () => {
    expect(normalizePhone('+221 77 123 45 67')).toBe('+221771234567');
    expect(normalizePhone('06 12 34 56 78')).toBe('0612345678');
    expect(normalizePhone('77-123-45-67')).toBe('771234567');
  });

  it('hashes and verifies 4-digit PIN codes', () => {
    const hash = hashPin('1234');
    expect(verifyPin('1234', hash)).toBe(true);
    expect(verifyPin('0000', hash)).toBe(false);
  });
});

describe('Multi-tenant Capabilities evaluation', () => {
  it('grants all capabilities to SUPER_ADMIN and ORG_ADMIN', () => {
    expect(hasCapability('SUPER_ADMIN', [], 'fleet:manage')).toBe(true);
    expect(hasCapability('ORG_ADMIN', [], 'members:manage')).toBe(true);
  });

  it('checks team capabilities for MEMBER role', () => {
    expect(hasCapability('MEMBER', ['fleet:read', 'couplings:change'], 'couplings:change')).toBe(true);
    expect(hasCapability('MEMBER', ['fleet:read'], 'members:manage')).toBe(false);
  });
});
```

- [ ] **Step 3: Implémenter `src/shared/types.ts`, `src/shared/permissions.ts` et `src/server/auth/pin.ts`**

Implémenter la normalisation du téléphone, le hachage `scryptSync` avec sel aléatoire, et la fonction `hasCapability`.

- [ ] **Step 4: Installer les dépendances et lancer Vitest**

Run: `npm install && npm test`
Expected: PASS sur `tests/pin-and-permissions.test.ts`

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat(core): initialize project config, design tokens, PIN auth and permission helpers"
```

---

### Task 2: Schéma Base de Données PostgreSQL (Drizzle), Migration Auto & Parseur d'Import Excel (`LISTE DE CAMIONS.xlsx`)

**Files:**
- Create: `src/server/db/schema.ts`
- Create: `src/server/db/index.ts`
- Create: `src/server/db/migrate.ts`
- Create: `src/server/services/excelImporter.ts`
- Create: `src/server/db/seed.ts`
- Test: `tests/excel-importer.test.ts`

**Interfaces:**
- Consumes: `src/shared/types.ts`, `src/server/auth/pin.ts`
- Produces:
  - `src/server/db/schema.ts` : tables Drizzle `organizations`, `teams`, `teamCapabilities`, `teamPreferences`, `users`, `sessions`, `tractors`, `trailers`, `couplings`, `breakdownCategories`, `garages`
  - `src/server/services/excelImporter.ts` : `parseTrucksExcelFile(filePath: string): Promise<ParsedTruckRow[]>`
  - `src/server/db/migrate.ts` : `ensureSchema(): Promise<void>`
  - `src/server/db/seed.ts` : `ensureSeedData(): Promise<void>`

- [ ] **Step 1: Écrire le test `tests/excel-importer.test.ts` sur le vrai fichier `.dev/Sample data/LISTE DE CAMIONS.xlsx`**

```typescript
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { parseTrucksExcelFile } from '../src/server/services/excelImporter';

describe('Excel Importer on LISTE DE CAMIONS.xlsx', () => {
  it('extracts all 146 truck combinations for WEST AFRICA LOGISTICS and SOYAK', async () => {
    const filePath = path.resolve(process.cwd(), '.dev/Sample data/LISTE DE CAMIONS.xlsx');
    const rows = await parseTrucksExcelFile(filePath);
    expect(rows.length).toBe(146);
    expect(rows[0]).toEqual({
      orderNumber: '#ORD-0001',
      organizationName: 'WEST AFRICA LOGISTICS',
      tractorPlate: '5895 CAT',
      trailerPlate: '5910 CAT',
      trailerType: 'BENNE',
    });
    const orgs = new Set(rows.map((r) => r.organizationName));
    expect(orgs.has('WEST AFRICA LOGISTICS')).toBe(true);
    expect(orgs.has('SOYAK')).toBe(true);
  });
});
```

- [ ] **Step 2: Implémenter `src/server/services/excelImporter.ts`, `src/server/db/schema.ts`, `src/server/db/migrate.ts` et `src/server/db/seed.ts`**

Implémenter le parseur ExcelJS (supportant un chemin de fichier ou un Buffer d'upload) ainsi que la création idempotente des tables PostgreSQL et le seed initial (Super Admin `0000000000` / PIN `1234`, Org Admin WAL `771234567` / PIN `1234`, Org Admin SOYAK `772223344` / PIN `1234`, Agent Terrain `789876543` / PIN `1234`, plus les 146 ensembles tracteur/remorque/attelage issus du fichier Excel).

- [ ] **Step 3: Vérifier le test `tests/excel-importer.test.ts`**

Run: `npx vitest run tests/excel-importer.test.ts`
Expected: PASS (146 lignes extraites avec succès)

- [ ] **Step 4: Commit**

```bash
git add src/server/db src/server/services tests/excel-importer.test.ts
git commit -m "feat(db): add PostgreSQL Drizzle schema, auto-migration, seed and Excel fleet importer"
```

---

### Task 3: Serveur API Hono (Auth PIN, Isolation Multi-Tenant, Parc/Attelages & Administration)

**Files:**
- Create: `src/server/auth/middleware.ts`
- Create: `src/server/routes/auth.ts`
- Create: `src/server/routes/organizations.ts`
- Create: `src/server/routes/fleet.ts`
- Create: `src/server/routes/admin.ts`
- Create: `src/server/app.ts`
- Create: `src/server/index.ts`

**Interfaces:**
- Consumes: `src/server/db/*`, `src/server/auth/pin.ts`, `src/server/services/excelImporter.ts`
- Produces:
  - Routes `/api/health`
  - Routes `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/switch-org`
  - Routes `/api/organizations` (liste globale Super Admin + KPIs + création + changement de statut `active`/`suspended`)
  - Routes `/api/fleet` (KPIs + liste filtrable des attelages + tracteurs/remorques libres + création véhicule + attelage/désattelage + import Excel)
  - Routes `/api/admin` (membres, équipes + capabilities/preferences, catégories de pannes, garages)

- [ ] **Step 1: Créer le middleware d'authentification et de résolution Multi-Tenant `src/server/auth/middleware.ts`**

Vérifie le token de session (header `Authorization: Bearer` ou cookie `logicam_session`), charge l'utilisateur, sa `team`, ses `capabilities` et `preferences`, et résout `effectiveOrgId` (forcé à `user.organizationId` pour `ORG_ADMIN` et `MEMBER`, ou pilotable via `X-Organization-Id` / `session.activeOrganizationId` pour `SUPER_ADMIN`).

- [ ] **Step 2: Implémenter les routes `auth.ts`, `organizations.ts`, `fleet.ts`, `admin.ts` et les assembler dans `app.ts` et `index.ts`**

S'assurer que `src/server/index.ts` sert également les assets statiques du build Vite (`dist/client`) en production avec fallback SPA sur `index.html`.

- [ ] **Step 3: Vérifier la compilation TypeScript du serveur**

Run: `npx tsc --noEmit`
Expected: Aucune erreur TypeScript

- [ ] **Step 4: Commit**

```bash
git add src/server
git commit -m "feat(api): implement Hono multi-tenant API routes for auth, fleet, couplings and admin"
```

---

### Task 4: Frontend React 19 — Design System `LogiCam Industrial OS` & Écrans (Connexion, Parc, Super Admin, Admin Org)

**Files:**
- Create: `src/client/index.css`
- Create: `src/client/lib/api.ts`
- Create: `src/client/context/AuthContext.tsx`
- Create: `src/client/components/PinKeypad.tsx`
- Create: `src/client/components/Layout.tsx`
- Create: `src/client/components/CouplingModal.tsx`
- Create: `src/client/pages/LoginPage.tsx`
- Create: `src/client/pages/FleetDashboard.tsx`
- Create: `src/client/pages/SuperAdminOrgs.tsx`
- Create: `src/client/pages/OrgAdminPage.tsx`
- Create: `src/client/App.tsx`
- Create: `src/client/main.tsx`

**Interfaces:**
- Consumes: `src/shared/types.ts`, `src/shared/permissions.ts`, API `/api/*`
- Produces: Application SPA React 19 complète fidèle aux maquettes `.dev/design/stitch_logicam.io_fleet_management_saas/`

- [ ] **Step 1: Créer `src/client/lib/api.ts` et `src/client/context/AuthContext.tsx` (incluant `useTeamPolicy`)**

Gérer le token de session, l'organisation active (`currentOrg`), la bascule d'organisation pour le `SUPER_ADMIN`, et le hook `useTeamPolicy()` exposant `can(capability)` et `getPreference(key)`.

- [ ] **Step 2: Créer `LoginPage.tsx` et `PinKeypad.tsx` fidèles à `connexion_logicam.io_fr/code.html`**

Implémenter le champ Téléphone, les 4 indicateurs visuels du code PIN, le pavé numérique tactile 3x4 en `JetBrains Mono`, la soumission automatique au 4ème chiffre, et un sélecteur d'accès rapide démo (Super Admin, Admin WAL, Admin SOYAK, Agent Terrain) pour faciliter les tests.

- [ ] **Step 3: Créer `Layout.tsx`, `FleetDashboard.tsx` et `CouplingModal.tsx` fidèles à `dashboard_op_rateur_fr/code.html`**

Implémenter :
- La `TopNavBar` et la `SideNavBar` industrielle avec indicateur "En ligne", badge de rôle, sélecteur d'organisation actif, et navigation filtrée par les permissions d'équipe.
- Le `FleetDashboard` avec les 3 cartes KPIs (Camions en service, En panne, Vidanges prévues), la barre de recherche temps réel (`N° ordre`, `tracteur`, `remorque`), les filtres par statut, le bouton d'import Excel `.xlsx`, la création/changement d'attelage (Atteler / Désatteler) et le changement rapide de statut (`En Service`, `En Panne`, `Maintenance`).

- [ ] **Step 4: Créer `SuperAdminOrgs.tsx` et `OrgAdminPage.tsx` fidèles à `super_admin_organisations_fr` et `admin_gestion_de_l_quipe_fr`**

Implémenter :
- `SuperAdminOrgs.tsx` : KPIs globaux (Organisations actives, Flotte totale, Utilisateurs), table des transporteurs avec bouton **"Gérer"** (qui bascule l'organisation active vers ce transporteur et ouvre son parc), création d'une nouvelle organisation, et suspension/activation d'abonnement.
- `OrgAdminPage.tsx` : 4 onglets (*Gestion des Membres* avec création téléphone + PIN, *Équipes & Permissions* avec matrice interactive des capabilities comme dans Vazy, *Catégories de Pannes*, et *Garages*).

- [ ] **Step 5: Vérifier le build complet (Client Vite + Serveur TypeScript)**

Run: `npm run build`
Expected: Build Vite client et compilation serveur réussis sans erreur.

- [ ] **Step 6: Commit**

```bash
git add src/client index.html
git commit -m "feat(ui): build LogiCam Industrial OS frontend (Login PIN, Fleet Dashboard, Super Admin, Org Admin)"
```

---

### Task 5: Conteneurisation Docker, Provisionnement Dokploy Pulsation (Postgres + Web) & Auto-Deploy sur `prod`

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `.env.example`

**Interfaces:**
- Consumes: Build `npm run build`, fichier Excel initial pour le seed embarqué
- Produces:
  - Conteneur Docker écoutant sur `0.0.0.0:3000`
  - Projet Dokploy `LogiCam` sur `dokploy-pulsation` avec service PostgreSQL `logicam-db` et application `logicam-web` reliée à `lazybird/logicam.io` (branche `prod`, `autoDeploy: true`).

- [ ] **Step 1: Créer `Dockerfile`, `.dockerignore` et copier les données de seed initiales dans `src/server/db/seed-data/fleet-initial.xlsx`**

Pour que le conteneur Docker sur Dokploy puisse exécuter le seed des 146 camions au premier démarrage sans dépendre du dossier `.dev/` (qui est ignoré par git), exporter les 146 lignes du fichier `.dev/Sample data/LISTE DE CAMIONS.xlsx` dans un fichier JSON versionné `src/server/db/seed-data/initial-fleet.json` utilisé par `seed.ts`.

- [ ] **Step 2: Tester le build et les tests unitaires localement**

Run: `npm test && npm run build`
Expected: Tous les tests passent et `dist/` est généré proprement.

- [ ] **Step 3: Pousser les branches `main` et `prod` sur `git@github.com:lazybird/logicam.io.git`**

```bash
git branch -M main
git push -u origin main
git checkout -b prod
git push -u origin prod
git checkout main
```

- [ ] **Step 4: Provisionner le projet `LogiCam` sur Dokploy Pulsation (`dokploy-pulsation`)**

1. Appeler `project-create` (`name: "LogiCam"`, `description: "SaaS de gestion de flotte et d'attelages multi-tenant"`).
2. Créer et déployer la base PostgreSQL dédiée avec `postgres-create` puis `postgres-deploy` (`name: "db"`, `appName: "logicam-db"`, `databaseName: "logicam"`, `databaseUser: "logicam"`, `dockerImage: "postgres:16-alpine"`).
3. Créer l'application web avec `application-create` (`name: "app"`, `appName: "logicam-web"`).
4. Configurer le provider GitHub avec `application-saveGithubProvider` (`owner: "lazybird"`, `repository: "logicam.io"`, `branch: "prod"`, `githubId: "rrt95wUL3NkoNnm-aO7jh"`, `triggerType: "push"`, `enableSubmodules: false`) et activer `autoDeploy: true` via `application-update`.
5. Configurer le build Dockerfile (`application-saveBuildType` avec `buildType: "dockerfile"`, `dockerfile: "Dockerfile"`).
6. Configurer les variables d'environnement (`application-saveEnvironment`) avec `DATABASE_URL=postgresql://logicam:<password>@logicam-db:5432/logicam` et `PORT=3000`.
7. Créer un domaine HTTPS sur Dokploy Pulsation (`domain-create`, ex. `logicam.pulsation.cloud`, `port: 3000`, `https: true`, `certificateType: "letsencrypt"`).
8. Déclencher le déploiement avec `application-deploy` et vérifier l'état du conteneur.
