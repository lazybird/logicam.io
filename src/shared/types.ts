export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'MEMBER';

export type Capability =
  | 'fleet:read'
  | 'fleet:manage'
  | 'fleet:import'
  | 'couplings:change'
  | 'incidents:create'
  | 'incidents:read'
  | 'incidents:manage'
  | 'members:read'
  | 'members:manage'
  | 'settings:manage';

export type PreferenceKey = 'default_view' | 'menu:excluded_items';

export type VehicleStatus = 'in_service' | 'breakdown' | 'maintenance';

export type TrailerType = 'BENNE' | 'PLATEAU' | 'CITERNE' | 'FRIGO' | 'AUTRE';

export interface UserDTO {
  id: string;
  organizationId: string | null;
  teamId: string | null;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: 'active' | 'inactive';
  lastLoginAt: string | null;
  createdAt: string;
  team?: TeamDTO | null;
  capabilities?: Capability[];
  preferences?: Record<string, string>;
}

export interface OrganizationDTO {
  id: string;
  name: string;
  slug: string;
  subscriptionStatus: 'active' | 'suspended';
  createdAt: string;
  stats?: {
    tractorsCount: number;
    trailersCount: number;
    activeCouplingsCount: number;
    membersCount: number;
  };
}

export interface TeamDTO {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdAt: string;
  capabilities?: Capability[];
  preferences?: Record<string, string>;
  membersCount?: number;
}

export interface TractorDTO {
  id: string;
  organizationId: string;
  plateNumber: string;
  brandModel: string | null;
  status: VehicleStatus;
  mileageKm: number;
  nextOilChangeKm: number | null;
  createdAt: string;
  isCoupled?: boolean;
}

export interface TrailerDTO {
  id: string;
  organizationId: string;
  plateNumber: string;
  trailerType: TrailerType;
  status: VehicleStatus;
  createdAt: string;
  isCoupled?: boolean;
}

export interface CouplingRowDTO {
  id: string;
  organizationId: string;
  orderNumber: string;
  tractorId: string;
  trailerId: string;
  tractorPlate: string;
  trailerPlate: string;
  trailerType: string;
  tractorStatus: VehicleStatus;
  trailerStatus: VehicleStatus;
  driverId?: string | null;
  driverName: string | null;
  isActive: boolean;
  coupledAt: string;
  uncoupledAt: string | null;
  createdById: string | null;
}

export interface DriverDTO {
  id: string;
  organizationId: string;
  fullName: string;
  phone?: string | null;
  licenseNumber?: string | null;
  status: 'active' | 'inactive';
  isAssigned?: boolean;
  currentCouplingId?: string | null;
  createdAt: string;
}

export interface FleetKpiDTO {
  totalCouplings: number;
  inServiceCouplings: number;
  breakdownCouplings: number;
  maintenanceCouplings: number;
  freeTractors: number;
  freeTrailers: number;
  totalTractors: number;
  totalTrailers: number;
}

export interface BreakdownCategoryDTO {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  severity: string;
  categoryType?: 'breakdown' | 'maintenance';
  description?: string | null;
}

export interface IncidentDTO {
  id: string;
  organizationId: string;
  type: 'breakdown' | 'maintenance';
  tractorId: string | null;
  trailerId: string | null;
  couplingId: string | null;
  categoryId: string | null;
  garageId: string | null;
  reportedById: string | null;
  notes: string | null;
  status: 'open' | 'resolved';
  resolvedAt: string | null;
  createdAt: string;
  category?: BreakdownCategoryDTO | null;
  garage?: GarageDTO | null;
  reportedByName?: string | null;
  tractorPlate?: string | null;
  trailerPlate?: string | null;
}

export interface GarageDTO {
  id: string;
  organizationId: string;
  name: string;
  location: string | null;
  contactPhone: string | null;
}

export interface ParsedTruckRow {
  orderNumber: string;
  organizationName: string;
  tractorPlate: string;
  trailerPlate: string;
  trailerType: string;
}
