import type { Capability, UserRole } from './types.js';

export interface CapabilityDefinition {
  id: Capability;
  label: string;
  description: string;
  category: 'fleet' | 'couplings' | 'incidents' | 'admin';
}

export const AVAILABLE_CAPABILITIES: readonly CapabilityDefinition[] = [
  {
    id: 'fleet:read',
    label: 'Consulter le parc',
    description: 'Visualiser la liste des tracteurs, remorques et leur état opérationnel',
    category: 'fleet',
  },
  {
    id: 'fleet:manage',
    label: 'Gérer les véhicules',
    description: 'Ajouter, modifier ou archiver des tracteurs et remorques',
    category: 'fleet',
  },
  {
    id: 'fleet:import',
    label: 'Importer la flotte Excel',
    description: 'Importer en masse des fichiers de camions au format XLSX',
    category: 'fleet',
  },
  {
    id: 'couplings:change',
    label: 'Modifier les attelages',
    description: 'Atteler, désatteler et réaffecter des ensembles tracteur-remorque',
    category: 'couplings',
  },
  {
    id: 'incidents:create',
    label: 'Déclarer un incident',
    description: 'Signaler une panne ou une avarie sur un ensemble',
    category: 'incidents',
  },
  {
    id: 'incidents:read',
    label: 'Consulter les pannes',
    description: 'Accéder au registre des déclarations et fiches pannes',
    category: 'incidents',
  },
  {
    id: 'incidents:manage',
    label: 'Gérer les interventions',
    description: 'Assigner un garage et suivre les réparations',
    category: 'incidents',
  },
  {
    id: 'members:read',
    label: 'Consulter les membres',
    description: 'Voir la liste des utilisateurs et équipes de l’organisation',
    category: 'admin',
  },
  {
    id: 'members:manage',
    label: 'Gérer les utilisateurs',
    description: 'Créer, éditer des comptes et attribuer les équipes',
    category: 'admin',
  },
  {
    id: 'settings:manage',
    label: 'Paramètres généraux',
    description: 'Gérer les garages partenaires et catégories de pannes',
    category: 'admin',
  },
] as const;

export const ALL_CAPABILITIES: Capability[] = AVAILABLE_CAPABILITIES.map((c) => c.id);

/**
 * Évalue si un rôle ou un jeu de capabilities autorise une action requise.
 * SUPER_ADMIN et ORG_ADMIN disposent de toutes les prérogatives.
 */
export function hasCapability(
  role: UserRole,
  capabilities: readonly string[] | null | undefined,
  required: Capability
): boolean {
  if (role === 'SUPER_ADMIN' || role === 'ORG_ADMIN') {
    return true;
  }
  if (!capabilities || !Array.isArray(capabilities)) {
    return false;
  }
  return capabilities.includes(required);
}
