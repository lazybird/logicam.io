export interface DefaultCatalogItem {
  name: string;
  code: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  categoryType: 'breakdown' | 'maintenance';
  description?: string;
}

/**
 * Référentiel initial exhaustif et réaliste pour le transport lourd & logistique
 * (Tracteurs routiers, Porteurs, Semi-remorques bennes, citernes, plateaux, frigos).
 */
export const DEFAULT_INCIDENT_CATALOG: DefaultCatalogItem[] = [
  // ==========================================
  // PANNES (BREAKDOWNS)
  // ==========================================
  {
    name: 'Système de Freinage / ABS / EBS',
    code: 'BRAKES',
    severity: 'critical',
    categoryType: 'breakdown',
    description: 'Plaquettes, disques, cylindres de frein, capteurs ABS/EBS ou fuite circuit de freinage',
  },
  {
    name: 'Pneumatiques (Crevaison / Éclatement)',
    code: 'TIRES',
    severity: 'high',
    categoryType: 'breakdown',
    description: 'Crevaison, usure anormale, hernie, éclat de bande de roulement ou valve fuyante',
  },
  {
    name: 'Moteur & Injection',
    code: 'ENGINE',
    severity: 'critical',
    categoryType: 'breakdown',
    description: 'Surchauffe, perte de puissance, voyant stop/moteur, injecteurs, turbo ou pompe haute pression',
  },
  {
    name: 'Transmission, Embrayage & Boîte',
    code: 'TRANSMISSION',
    severity: 'critical',
    categoryType: 'breakdown',
    description: 'Patinage embrayage, boîte bloquée, arbre de transmission, pont arrière ou différentiel',
  },
  {
    name: 'Circuit Pneumatique & Air comprimé',
    code: 'AIR_SYSTEM',
    severity: 'high',
    categoryType: 'breakdown',
    description: 'Compresseur, dessiccateur d’air, flexibles spiralés, fuite d’air cuves ou suspension pneumatique',
  },
  {
    name: 'Électrique, Alternateur & Démarrage',
    code: 'ELECTRICAL',
    severity: 'high',
    categoryType: 'breakdown',
    description: 'Batteries déchargées/HS, alternateur, démarreur, faisceau électrique ou court-circuit',
  },
  {
    name: 'Éclairage & Signalisation',
    code: 'LIGHTING',
    severity: 'medium',
    categoryType: 'breakdown',
    description: 'Feux de croisement/route défaillants, feux arrière remorque, clignotants ou gyrophares',
  },
  {
    name: 'Direction & Suspension',
    code: 'STEERING_SUSP',
    severity: 'high',
    categoryType: 'breakdown',
    description: 'Biellettes de direction, jeu anormal, amortisseurs, coussins d’air crevés ou lames de ressort cassées',
  },
  {
    name: 'Circuit de Refroidissement & Climatisation',
    code: 'COOLING',
    severity: 'high',
    categoryType: 'breakdown',
    description: 'Fuite liquide de refroidissement, radiateur percé, pompe à eau, durite ou courroie accessoire',
  },
  {
    name: 'Sellette, Pivot & Dispositif d’Attelage',
    code: 'COUPLING_SYS',
    severity: 'critical',
    categoryType: 'breakdown',
    description: 'Verrouillage sellette défectueux, béquilles de remorque tordues/bloquées, cheville ouvrière usée',
  },
  {
    name: 'Hydraulique (Vérin de benne, Hayon)',
    code: 'HYDRAULIC',
    severity: 'high',
    categoryType: 'breakdown',
    description: 'Fuite huile vérin de levage, distributeur hydraulique, flexibles ou pompe de prise de mouvement',
  },
  {
    name: 'Groupe Frigorifique (Pour Remorques Frigo)',
    code: 'REEFER',
    severity: 'critical',
    categoryType: 'breakdown',
    description: 'Panne moteur thermique auxiliaire, alarme température, manque de gaz frigorigène',
  },
  {
    name: 'Carrosserie, Châssis & Équipements',
    code: 'BODY',
    severity: 'low',
    categoryType: 'breakdown',
    description: 'Porte remorque bloquée, bâchage abîmé, pare-chocs, bavette arrachée ou rétro cassé',
  },

  // ==========================================
  // SUJETS DE MAINTENANCE (MAINTENANCE TOPICS)
  // ==========================================
  {
    name: 'Vidange Moteur & Remplacement Filtres',
    code: 'OIL_CHANGE',
    severity: 'medium',
    categoryType: 'maintenance',
    description: 'Huile moteur synthétique, filtre à huile, filtre à carburant et filtre à air',
  },
  {
    name: 'Révision Générale Périodique (Mines / Contrôle)',
    code: 'PERIODIC_INSPECT',
    severity: 'high',
    categoryType: 'maintenance',
    description: 'Visite réglementaire semestrielle/annuelle, contrôle technique poids lourd, banc de freinage',
  },
  {
    name: 'Entretien & Remplacement Freinage',
    code: 'BRAKE_SERVICE',
    severity: 'high',
    categoryType: 'maintenance',
    description: 'Remplacement disques et plaquettes, garnitures, purge liquide ou réglage rattrapage automatique',
  },
  {
    name: 'Permutation & Remplacement Pneumatiques',
    code: 'TIRE_ROTATION',
    severity: 'medium',
    categoryType: 'maintenance',
    description: 'Permutation des trains de pneus, équilibrage, parallélisme et montage pneus neufs/rechapés',
  },
  {
    name: 'Graissage Complet & Contrôle Châssis',
    code: 'GREASING',
    severity: 'low',
    categoryType: 'maintenance',
    description: 'Graissage sellette, pivots de fusées, cardans, roulements de roues et points d’articulation',
  },
  {
    name: 'Contrôle & Étalonnage Chronotachygraphe / Limiteur',
    code: 'TACHO_CALIBRATION',
    severity: 'high',
    categoryType: 'maintenance',
    description: 'Vérification légale biennale du tachygraphe numérique et limiteur de vitesse en centre agréé',
  },
  {
    name: 'Entretien Circuit Climatisation & Chauffage Cabine',
    code: 'AC_SERVICE',
    severity: 'low',
    categoryType: 'maintenance',
    description: 'Recharge fluide frigo cabine, filtre d’habitacle, détection de fuite et désinfection',
  },
  {
    name: 'Vérification Hayon Élévateur / Organes de Levage',
    code: 'LIFT_GATE_INSPECT',
    severity: 'medium',
    categoryType: 'maintenance',
    description: 'Contrôle VGP (Vérification Générale Périodique), niveau d’huile centrale hydraulique et sécurité',
  },
  {
    name: 'Contrôle Extincteurs & Équipements de Sécurité',
    code: 'SAFETY_EQUIPMENT',
    severity: 'medium',
    categoryType: 'maintenance',
    description: 'Vérification annuelle des extincteurs de bord, cales de roues, triangles et trousse secours',
  },
];
