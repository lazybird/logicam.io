# Spécification Technique & Architecture — LogiCam.io (Phase 1)

**Date** : 10 Novembre 2026  
**Projet** : LogiCam.io — SaaS Industriel de Gestion de Flotte & Attelages  
**Cible de Déploiement** : Dokploy Pulsation (`dokploy-pulsation` — `https://deploy.pulsation.cloud`)  
**Dépôt Git** : `git@github.com:lazybird/logicam.io.git` (branche de déploiement auto : `prod`)

---

## 1. Contexte et Objectifs

**LogiCam.io** est une plateforme SaaS multi-tenant destinée aux transporteurs routiers et gestionnaires de flotte (ex. *West Africa Logistics*, *SOYAK*). Elle permet de piloter en temps réel l'état d'un parc de tracteurs et de remorques, de suivre les attelages actifs et leur historique, de gérer les équipes opérationnelles avec une politique fine de permissions (héritée et modernisée depuis le projet *Vazy*), et de déclarer rapidement les pannes et incidents.

Le périmètre de la **Phase 1** couvre :
1. **Socle Technique & Déploiement Continu** : Monorepo/Fullstack Hono + Drizzle ORM + React 19 (Vite) + PostgreSQL 16 dédié sur Dokploy Pulsation, avec auto-deploy sur push vers `prod`.
2. **Authentification Industrielle Téléphone + PIN** : Connexion rapide par numéro de téléphone et code PIN à 4 chiffres sur pavé numérique tactile, sécurisée côté serveur (sessions `HttpOnly` + hachage `scrypt`/`bcrypt`).
3. **Architecture Multi-Tenant à 3 Niveaux** :
   - Niveau 1 : `SUPER_ADMIN` (Console globale multi-transporteurs, création d'organisations, bascule de contexte vers n'importe quelle organisation).
   - Niveau 2 : `ORG_ADMIN` (Gestion des membres, équipes, garages, catégories de pannes et flotte de son organisation).
   - Niveau 3 : `MEMBER` rattaché à une équipe (`teams`) dotée de `team_capabilities` (permissions d'action) et `team_preferences` (vue par défaut, éléments de menu masqués).
4. **Gestion du Parc & des Attelages (Tracteurs + Remorques)** :
   - Séparation physique entre `tractors` (tracteurs routiers avec kilométrage, échéance vidange) et `trailers` (remorques typées : `BENNE`, `PLATEAU`, `CITERNE`, etc.).
   - Table `couplings` gérant l'attelage actif (`#ORD-XXXX`) ainsi que l'historique complet d'attelage/désattelage.
5. **Import Excel & Initialisation (Seed)** :
   - Pipeline d'importation natif prenant en charge le format de fichier `LISTE DE CAMIONS.xlsx` (146 ensembles répartis sur *WEST AFRICA LOGISTICS* et *SOYAK*).

---

## 2. Stack Technique Modernisée

| Couche | Technologie | Justification par rapport à Vazy |
| :--- | :--- | :--- |
| **Runtime & Serveur API** | **Node.js 22 + Hono** (`@hono/node-server`) | Ultra-léger, standard Web Fetch API, sert à la fois `/api/*` et le build statique Vite sur le port `3000`. |
| **Typage API E2E** | **Hono RPC + Zod** (`@hono/zod-validator`) | Partage direct des types entre les routes serveur et le client React sans étape de codegen. |
| **Base de données & ORM** | **PostgreSQL 16 (Dokploy) + Drizzle ORM** (`drizzle-orm`, `pg`) | Remplace Supabase par un Postgres standard sur Dokploy avec un schéma TypeScript typé et des migrations versionnées. |
| **Frontend UI** | **React 19 + Vite 6 + TypeScript** | Reprise de la vélocité de Vazy avec React 19 et TanStack Query v5 pour le cache et l'état serveur. |
| **Design System** | **Tailwind CSS v3.4 + LogiCam Industrial OS** | Implémentation stricte des tokens `.dev/design/stitch_logicam.io_fleet_management_saas/logicam_industrial_os/DESIGN.md` (`#0b1326`, `#ff8c00`, `JetBrains Mono` + `Geist`). |
| **Import / Export** | **ExcelJS** | Lecture du fichier `.dev/Sample data/LISTE DE CAMIONS.xlsx` et import/export depuis l'interface. |

---

## 3. Modèle de Données (Schéma Drizzle / PostgreSQL)

### 3.1. Entités Multi-Tenant & Authentification

- **`organizations`** :
  - `id` (UUID PK)
  - `name` (TEXT NOT NULL, ex: `"West Africa Logistics"`)
  - `slug` (TEXT UNIQUE NOT NULL, ex: `"west-africa-logistics"`)
  - `subscription_status` (TEXT NOT NULL DEFAULT `'active'` — `'active' | 'suspended'`)
  - `created_at` (TIMESTAMPTZ DEFAULT NOW())

- **`teams`** :
  - `id` (UUID PK)
  - `organization_id` (UUID FK -> `organizations.id` ON DELETE CASCADE)
  - `name` (TEXT NOT NULL, ex: `"Exploitation"`, `"Maintenance"`, `"Terrain"`)
  - `description` (TEXT)
  - `created_at` (TIMESTAMPTZ DEFAULT NOW())
  - UNIQUE(`organization_id`, `name`)

- **`team_capabilities`** :
  - `id` (UUID PK)
  - `team_id` (UUID FK -> `teams.id` ON DELETE CASCADE)
  - `capability` (TEXT NOT NULL) — Valeurs supportées :
    - `fleet:read`, `fleet:manage`, `fleet:import`
    - `couplings:change`
    - `incidents:create`, `incidents:read`, `incidents:manage`
    - `members:read`, `members:manage`
    - `settings:manage`
  - UNIQUE(`team_id`, `capability`)

- **`team_preferences`** :
  - `id` (UUID PK)
  - `team_id` (UUID FK -> `teams.id` ON DELETE CASCADE)
  - `preference_key` (TEXT NOT NULL) — `'default_view' | 'menu:excluded_items'`
  - `preference_value` (TEXT NOT NULL)
  - UNIQUE(`team_id`, `preference_key`)

- **`users`** :
  - `id` (UUID PK)
  - `organization_id` (UUID FK -> `organizations.id` ON DELETE CASCADE, nullable pour un Super Admin global)
  - `team_id` (UUID FK -> `teams.id` ON DELETE SET NULL, nullable)
  - `phone` (TEXT UNIQUE NOT NULL, normalisé sans espaces, ex: `+221771234567` ou `0612345678`)
  - `email` (TEXT, optionnel, utile pour l'affichage admin ex: `a.diallo@wal.com`)
  - `pin_hash` (TEXT NOT NULL, hachage sécurisé du code PIN à 4 chiffres)
  - `first_name` (TEXT NOT NULL)
  - `last_name` (TEXT NOT NULL)
  - `role` (TEXT NOT NULL DEFAULT `'MEMBER'` — `'SUPER_ADMIN' | 'ORG_ADMIN' | 'MEMBER'`)
  - `status` (TEXT NOT NULL DEFAULT `'active'` — `'active' | 'inactive'`)
  - `last_login_at` (TIMESTAMPTZ)
  - `created_at` (TIMESTAMPTZ DEFAULT NOW())

- **`sessions`** :
  - `id` (TEXT PK, token aléatoire 256 bits)
  - `user_id` (UUID FK -> `users.id` ON DELETE CASCADE)
  - `active_organization_id` (UUID FK -> `organizations.id` ON DELETE SET NULL — permet au `SUPER_ADMIN` ou à l'utilisateur de cibler l'organisation courante)
  - `expires_at` (TIMESTAMPTZ NOT NULL)
  - `created_at` (TIMESTAMPTZ DEFAULT NOW())

### 3.2. Entités Flotte, Attelages & Paramétrage Métier

- **`tractors`** (Tracteurs) :
  - `id` (UUID PK)
  - `organization_id` (UUID FK -> `organizations.id` ON DELETE CASCADE)
  - `plate_number` (TEXT NOT NULL, ex: `"5895 CAT"`)
  - `brand_model` (TEXT, ex: `"VOLVO FH16"`)
  - `status` (TEXT NOT NULL DEFAULT `'in_service'` — `'in_service' | 'breakdown' | 'maintenance'`)
  - `mileage_km` (INTEGER NOT NULL DEFAULT 0)
  - `next_oil_change_km` (INTEGER)
  - `created_at` (TIMESTAMPTZ DEFAULT NOW())
  - UNIQUE(`organization_id`, `plate_number`)

- **`trailers`** (Remorques) :
  - `id` (UUID PK)
  - `organization_id` (UUID FK -> `organizations.id` ON DELETE CASCADE)
  - `plate_number` (TEXT NOT NULL, ex: `"5910 CAT"`)
  - `trailer_type` (TEXT NOT NULL DEFAULT `'BENNE'` — `'BENNE' | 'PLATEAU' | 'CITERNE' | 'FRIGO' | 'AUTRE'`)
  - `status` (TEXT NOT NULL DEFAULT `'in_service'` — `'in_service' | 'breakdown' | 'maintenance'`)
  - `created_at` (TIMESTAMPTZ DEFAULT NOW())
  - UNIQUE(`organization_id`, `plate_number`)

- **`couplings`** (Attelages & Historique) :
  - `id` (UUID PK)
  - `organization_id` (UUID FK -> `organizations.id` ON DELETE CASCADE)
  - `order_number` (TEXT NOT NULL, ex: `"#ORD-0001"`)
  - `tractor_id` (UUID FK -> `tractors.id` ON DELETE CASCADE)
  - `trailer_id` (UUID FK -> `trailers.id` ON DELETE CASCADE)
  - `driver_name` (TEXT)
  - `is_active` (BOOLEAN NOT NULL DEFAULT TRUE)
  - `coupled_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
  - `uncoupled_at` (TIMESTAMPTZ)
  - `created_by_id` (UUID FK -> `users.id` ON DELETE SET NULL)

- **`breakdown_categories`** (Catégories de Pannes par Organisation) :
  - `id` (UUID PK)
  - `organization_id` (UUID FK -> `organizations.id` ON DELETE CASCADE)
  - `name` (TEXT NOT NULL, ex: `"Moteur / Transmission"`, `"Système de Freinage"`, `"Pneumatiques"`)
  - `code` (TEXT NOT NULL, ex: `"ENGINE"`, `"BRAKES"`, `"TIRES"`)
  - `severity` (TEXT NOT NULL DEFAULT `'high'`)

- **`garages`** (Garages / Ateliers par Organisation) :
  - `id` (UUID PK)
  - `organization_id` (UUID FK -> `organizations.id` ON DELETE CASCADE)
  - `name` (TEXT NOT NULL, ex: `"Atelier Central Dakar"`, `"Garage Zone Industrielle"`)
  - `location` (TEXT)
  - `contact_phone` (TEXT)

---

## 4. Architecture Sécurité & Isolation Multi-Tenant

1. **Middleware d'Authentification (`authMiddleware`)** :
   - Lit le cookie `logicam_session` (ou header `Authorization: Bearer <token>`).
   - Charge la session et l'utilisateur associé depuis PostgreSQL.
   - Détermine l'`organizationId` effective :
     - Pour un `ORG_ADMIN` ou `MEMBER` : **toujours** forcé à `user.organization_id` (impossible d'accéder aux données d'un autre tenant).
     - Pour un `SUPER_ADMIN` : utilise le header `X-Organization-Id` ou `session.active_organization_id` (avec fallback sur la première organisation active).
2. **Hook Frontend `useTeamPolicy`** :
   - Expose `can(capability)`, `getPreference(key)`, `isSuperAdmin`, `isOrgAdmin`.
   - Adapte dynamiquement la barre latérale (`SideNavBar`) et les actions disponibles à l'écran.

---

## 5. Design System & Composants (`LogiCam Industrial OS`)

Conformément à `.dev/design/stitch_logicam.io_fleet_management_saas/logicam_industrial_os/DESIGN.md` :
- **Palette** :
  - `background` / `surface` : `#0b1326`, `surface-container-lowest` : `#060e20`, `surface-container` : `#171f33`, `surface-variant` : `#2d3449`.
  - `primary-container` : `#ff8c00` (Construction Orange), `primary` : `#ffb77d`.
  - `secondary` : `#c0c1ff` / `#6366f1` (Admin Indigo).
  - `tertiary` : `#4edea3` / `#22c087` (Emerald — En service / Actif).
  - `error` : `#ffb4ab` / `#93000a` (En panne / Critique).
  - Bordures : `1px solid #334155` ou `#564334` (`outline-variant`), zéro ombres portées sur les cartes, focus input avec bordure gauche `2px solid #ff8c00`.
- **Polices** :
  - `JetBrains Mono` pour les titres (`display-lg`, `headline-lg`, `headline-md`), les badges/labels (`label-md`, `label-sm` en majuscules) et toutes les cellules de tableaux (`data-tabular`).
  - `Geist` pour le texte courant (`body-md`, `body-sm`).

---

## 6. Infrastructure Dokploy Pulsation & CI/CD

1. **Serveur MCP Cible** : `dokploy-pulsation` (`https://deploy.pulsation.cloud`).
2. **Projet Dokploy** : `LogiCam`
   - **Service PostgreSQL (`logicam-db`)** : Image `postgres:16-alpine`, base `logicam`, utilisateur dédié, accessible sur le réseau interne Docker.
   - **Service Application (`logicam-web`)** :
     - Source : GitHub (`owner: "lazybird"`, `repository: "logicam.io"`, `branch: "prod"`, `githubId: "rrt95wUL3NkoNnm-aO7jh"`).
     - `triggerType: "push"`, `autoDeploy: true`.
     - `buildType: "dockerfile"`, `dockerfile: "Dockerfile"`, port exposé `3000`.
     - Au démarrage du conteneur (`CMD`), exécution automatique des migrations SQL Drizzle et du seed initial (idempotent) avant d'écouter sur `0.0.0.0:3000`.
3. **Workflow Git** :
   - Développement et commits atomiques sur `main`.
   - Fusion et push vers `origin/prod` pour déclencher automatiquement le build et le déploiement sur Dokploy Pulsation.
