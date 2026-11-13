import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Truck,
  AlertTriangle,
  Wrench,
  Search,
  Plus,
  FileSpreadsheet,
  Unlink,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  PlusCircle,
  X,
  Gauge,
  User,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, useTeamPolicy } from '../context/AuthContext';
import { CouplingModal } from '../components/CouplingModal';
import { UncoupleModal } from '../components/UncoupleModal';
import { BreakdownModal } from '../components/BreakdownModal';
import { useEscapeKey } from '../hooks/useEscapeKey';
import type {
  CouplingRowDTO,
  FleetKpiDTO,
  TractorDTO,
  TrailerDTO,
  TrailerType,
  VehicleStatus,
  BreakdownCategoryDTO,
} from '../../shared/types';

interface FleetApiResponse {
  kpis: FleetKpiDTO & { oilChangesDueCount: number };
  couplings: (CouplingRowDTO & {
    tractorBrandModel?: string | null;
    mileageKm?: number;
    nextOilChangeKm?: number | null;
  })[];
  tractors: TractorDTO[];
  trailers: TrailerDTO[];
  breakdownCategories?: BreakdownCategoryDTO[];
}

export const FleetDashboard: React.FC = () => {
  const { currentOrg } = useAuth();
  const { can } = useTeamPolicy();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FleetApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | VehicleStatus>('ALL');
  const [activeTab, setActiveTab] = useState<'couplings' | 'unassigned'>('couplings');
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  const toggleRowExpanded = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Modales
  const [isCouplingModalOpen, setIsCouplingModalOpen] = useState(false);
  const [preselectedTractorId, setPreselectedTractorId] = useState<string | undefined>();
  const [preselectedTrailerId, setPreselectedTrailerId] = useState<string | undefined>();

  // Modale de désattelage
  const [uncoupleTarget, setUncoupleTarget] = useState<{ id: string; label: string } | null>(null);

  // Modale de déclaration de panne
  const [breakdownTarget, setBreakdownTarget] = useState<{
    id: string;
    orderNumber: string;
    tractorId: string;
    tractorPlate: string;
    tractorStatus: VehicleStatus;
    trailerId: string;
    trailerPlate: string;
    trailerStatus: VehicleStatus;
  } | null>(null);

  // Modale d'ajout rapide de véhicule
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [vehicleKind, setVehicleKind] = useState<'tractor' | 'trailer'>('tractor');
  const [newPlate, setNewPlate] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newTrailerType, setNewTrailerType] = useState<TrailerType>('BENNE');

  useEscapeKey(isAddVehicleOpen, () => setIsAddVehicleOpen(false));

  // Import Excel
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const loadFleet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<FleetApiResponse>('/api/fleet');
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors du chargement de la flotte');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFleet();
  }, [currentOrg?.id]);

  // Filtrage des attelages
  const filteredCouplings = useMemo(() => {
    if (!data?.couplings) return [];

    return data.couplings.filter((item) => {
      // Filtre statut
      if (statusFilter !== 'ALL') {
        const itemStatus =
          item.tractorStatus === 'breakdown' || item.trailerStatus === 'breakdown'
            ? 'breakdown'
            : item.tractorStatus === 'maintenance' || item.trailerStatus === 'maintenance'
            ? 'maintenance'
            : 'in_service';

        if (itemStatus !== statusFilter) return false;
      }

      // Recherche textuelle
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchOrder = item.orderNumber.toLowerCase().includes(term);
        const matchTractor = item.tractorPlate.toLowerCase().includes(term);
        const matchTrailer = item.trailerPlate.toLowerCase().includes(term);
        const matchDriver = item.driverName?.toLowerCase().includes(term);
        const matchType = item.trailerType.toLowerCase().includes(term);
        const matchModel = item.tractorBrandModel?.toLowerCase().includes(term);

        return matchOrder || matchTractor || matchTrailer || matchDriver || matchType || matchModel;
      }

      return true;
    });
  }, [data?.couplings, search, statusFilter]);

  // Véhicules libres
  const freeTractors = useMemo(() => {
    return data?.tractors.filter((t) => !t.isCoupled) || [];
  }, [data?.tractors]);

  const freeTrailers = useMemo(() => {
    return data?.trailers.filter((tr) => !tr.isCoupled) || [];
  }, [data?.trailers]);

  // Véhicules libres opérationnels (en service)
  const operationalFreeTractors = useMemo(() => {
    return freeTractors.filter((t) => t.status === 'in_service');
  }, [freeTractors]);

  const operationalFreeTrailers = useMemo(() => {
    return freeTrailers.filter((tr) => tr.status === 'in_service');
  }, [freeTrailers]);

  // Nombre d'attelages complets réalisables immédiatement
  const formableCouplings = Math.min(
    operationalFreeTractors.length,
    operationalFreeTrailers.length
  );

  // Désatteler un ensemble
  const handleUncouple = async (couplingId: string) => {
    const row = filteredCouplings.find((c) => c.id === couplingId);
    if (!row) return;
    const label = `${row.tractorPlate} + ${row.trailerPlate}`;
    setUncoupleTarget({ id: couplingId, label });
  };

  // Changement rapide de statut d'un attelage (ou déclenchement de la modale de panne)
  const handleStatusChangeRequest = async (
    row: (typeof filteredCouplings)[number],
    newStatus: VehicleStatus
  ) => {
    if (newStatus === 'breakdown') {
      // Ouvre la modale complète pour choisir tracteur / remorque / les deux et la catégorie
      setBreakdownTarget({
        id: row.id,
        orderNumber: row.orderNumber,
        tractorId: row.tractorId,
        tractorPlate: row.tractorPlate,
        tractorStatus: row.tractorStatus,
        trailerId: row.trailerId,
        trailerPlate: row.trailerPlate,
        trailerStatus: row.trailerStatus,
      });
      return;
    }

    try {
      // Remise en service ou passage en maintenance : s'applique aux deux composants de l'attelage
      await Promise.all([
        api.patch(`/api/fleet/tractors/${row.tractorId}`, { status: newStatus }),
        api.patch(`/api/fleet/trailers/${row.trailerId}`, { status: newStatus }),
      ]);
      loadFleet();
    } catch (err: any) {
      alert(err?.message || 'Erreur lors de la mise à jour du statut');
    }
  };

  // Ajout de véhicule
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate.trim()) return;

    try {
      if (vehicleKind === 'tractor') {
        await api.post('/api/fleet/tractors', {
          plateNumber: newPlate,
          brandModel: newModel.trim() || undefined,
          status: 'in_service',
        });
      } else {
        await api.post('/api/fleet/trailers', {
          plateNumber: newPlate,
          trailerType: newTrailerType,
          status: 'in_service',
        });
      }

      setNewPlate('');
      setNewModel('');
      setIsAddVehicleOpen(false);
      loadFleet();
    } catch (err: any) {
      alert(err?.message || 'Erreur lors de l’ajout du véhicule');
    }
  };

  // Import Excel (.xlsx)
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportNotice(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post<{ success: boolean; importedCount: number }>(
        '/api/fleet/import',
        formData
      );

      setImportNotice(`Importation réussie : ${res.importedCount} camions intégrés au parc.`);
      loadFleet();
    } catch (err: any) {
      setImportNotice(`Échec de l'import : ${err?.message || 'Format invalide'}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
      {/* Barre d'en-tête & Actions principales */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold text-on-surface flex items-center gap-2">
            <span>État du Parc</span>
            {currentOrg && (
              <span className="text-sm font-normal text-on-surface-variant font-mono">
                — {currentOrg.name}
              </span>
            )}
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Supervision opérationnelle des attelages tracteurs-remorques en temps réel
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Bouton rafraîchir */}
          <button
            type="button"
            onClick={loadFleet}
            disabled={loading}
            className="p-2 rounded border border-[#334155] hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors"
            title="Rafraîchir"
            aria-label="Rafraîchir l'état du parc"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Import Excel */}
          {can('fleet:import') && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx"
                onChange={handleExcelUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="px-3 py-2 border border-[#334155] hover:border-primary rounded font-mono text-xs text-on-surface hover:text-primary transition-colors flex items-center gap-2 bg-surface-container"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>{importing ? 'Import en cours...' : 'Importer Excel'}</span>
              </button>
            </>
          )}

          {/* Ajouter un véhicule */}
          {can('fleet:manage') && (
            <button
              type="button"
              onClick={() => setIsAddVehicleOpen(true)}
              className="px-3 py-2 border border-[#334155] hover:border-primary rounded font-mono text-xs text-on-surface hover:text-primary transition-colors flex items-center gap-2 bg-surface-container"
            >
              <Plus className="w-4 h-4 text-primary" />
              <span>Véhicule</span>
            </button>
          )}

          {/* Nouvel Attelage */}
          {can('couplings:change') && (
            <button
              type="button"
              onClick={() => {
                setPreselectedTractorId(undefined);
                setPreselectedTrailerId(undefined);
                setIsCouplingModalOpen(true);
              }}
              className="px-4 py-2 bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-mono text-xs font-semibold rounded flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(255,140,0,0.3)]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>NOUVEL ATTELAGE</span>
            </button>
          )}
        </div>
      </div>

      {/* Notification d'import */}
      {importNotice && (
        <div className="p-3 bg-surface-container border border-primary/40 rounded text-xs font-mono flex items-center justify-between">
          <span>{importNotice}</span>
          <button
            type="button"
            onClick={() => setImportNotice(null)}
            className="text-on-surface-variant hover:text-on-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3 Cartes KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1 : En service */}
        <div className="bg-surface border border-[#334155] rounded p-4 flex flex-col gap-1.5 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#4edea3]"></div>
          <div className="font-mono text-xs uppercase tracking-wider text-on-surface-variant flex items-center justify-between">
            <span>Camions en service</span>
            <Truck className="w-4 h-4 text-[#4edea3]" />
          </div>
          <div className="font-mono text-3xl font-bold text-on-surface">
            {data?.kpis.inServiceCouplings ?? 0}
          </div>
          <div className="font-mono text-[11px] text-[#4edea3] flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Sur {data?.kpis.totalCouplings ?? 0} attelages actifs</span>
          </div>
        </div>

        {/* KPI 2 : En panne */}
        <div className="bg-surface border border-[#334155] rounded p-4 flex flex-col gap-1.5 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ffb4ab]"></div>
          <div className="font-mono text-xs uppercase tracking-wider text-on-surface-variant flex items-center justify-between">
            <span>En panne</span>
            <AlertTriangle className="w-4 h-4 text-[#ffb4ab]" />
          </div>
          <div className="font-mono text-3xl font-bold text-[#ffb4ab]">
            {data?.kpis.breakdownCouplings ?? 0}
          </div>
          <div className="font-mono text-[11px] text-[#ffb4ab]">
            Nécessite intervention immédiate
          </div>
        </div>

        {/* KPI 3 : Vidanges prévues */}
        <div className="bg-surface border border-[#334155] rounded p-4 flex flex-col gap-1.5 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff8c00]"></div>
          <div className="font-mono text-xs uppercase tracking-wider text-on-surface-variant flex items-center justify-between">
            <span>Vidanges Prévues</span>
            <Wrench className="w-4 h-4 text-[#ff8c00]" />
          </div>
          <div className="font-mono text-3xl font-bold text-[#ffb77d]">
            {data?.kpis.oilChangesDueCount ?? 0}
          </div>
          <div className="font-mono text-[11px] text-on-surface-variant">
            Échéance sous 5 000 km
          </div>
        </div>
      </div>

      {/* Barre de pilotage de la réserve et sélection de vue */}
      <div className="bg-surface-container border border-[#334155] rounded p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
        {/* Indicateur de capacité opérationnelle immédiate */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-on-surface-variant text-[11px] uppercase tracking-wider font-semibold">
            Réserve opérationnelle :
          </span>

          {formableCouplings > 0 ? (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#4edea3]/10 border border-[#4edea3]/30 text-[#4edea3]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
              <span className="font-semibold">
                {formableCouplings} attelage{formableCouplings > 1 ? 's' : ''} composable{formableCouplings > 1 ? 's' : ''} immédiatement
              </span>
              <span className="text-on-surface-variant text-[11px]">
                ({operationalFreeTractors.length} tracteur{operationalFreeTractors.length > 1 ? 's' : ''} & {operationalFreeTrailers.length} remorque{operationalFreeTrailers.length > 1 ? 's' : ''} prêts)
              </span>
            </div>
          ) : operationalFreeTractors.length > 0 || operationalFreeTrailers.length > 0 ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {operationalFreeTractors.length > 0
                  ? `${operationalFreeTractors.length} tracteur${operationalFreeTractors.length > 1 ? 's' : ''} en attente de remorque`
                  : `${operationalFreeTrailers.length} remorque${operationalFreeTrailers.length > 1 ? 's' : ''} en attente de tracteur`}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-high border border-[#334155] text-on-surface-variant">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#4edea3]" />
              <span>100% de la flotte mobilisée (aucun matériel en attente)</span>
            </div>
          )}
        </div>

        {/* Sélecteur de vue (onglets) avec badges compacts */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('couplings')}
            className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 ${
              activeTab === 'couplings'
                ? 'bg-[#ff8c00] text-black font-semibold shadow-[0_0_10px_rgba(255,140,0,0.2)]'
                : 'bg-surface border border-[#334155] text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span>Attelés</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                activeTab === 'couplings'
                  ? 'bg-black/20 text-black font-bold'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {data?.couplings.length ?? 0}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unassigned')}
            className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1.5 ${
              activeTab === 'unassigned'
                ? 'bg-[#ff8c00] text-black font-semibold shadow-[0_0_10px_rgba(255,140,0,0.2)]'
                : 'bg-surface border border-[#334155] text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span>Non attelés</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] ${
                activeTab === 'unassigned'
                  ? 'bg-black/20 text-black font-bold'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}
            >
              {freeTractors.length + freeTrailers.length}
            </span>
          </button>
        </div>
      </div>

      {/* Vue Onglet 1 : Tableau des Attelages */}
      {activeTab === 'couplings' && (
        <div className="bg-surface border border-[#334155] rounded flex flex-col flex-1 overflow-hidden">
          {/* Barre de recherche et filtres de statut */}
          <div className="p-3 bg-surface-container border-b border-[#334155] flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher N° ordre, tracteur, remorque, chauffeur..."
                className="w-full bg-[#020617] border border-[#334155] rounded pl-9 pr-3 py-1.5 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-[#ff8c00]"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {(
                [
                  { id: 'ALL', label: 'Tous' },
                  { id: 'in_service', label: 'En Service' },
                  { id: 'breakdown', label: 'En Panne' },
                  { id: 'maintenance', label: 'Maintenance' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded font-mono text-xs whitespace-nowrap transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-primary-container text-black font-semibold'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tableau Unifié & Responsive avec Accordéon Interactif */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead className="sticky top-0 bg-surface-container-highest border-b border-[#334155] z-10">
                <tr>
                  {/* Sur mobile, colonne compacte N° Ordre + bouton chevron */}
                  <th className="py-2.5 px-3 uppercase text-on-surface-variant font-medium">N° ORDRE</th>
                  <th className="py-2.5 px-3 uppercase text-on-surface-variant font-medium">TRACTEUR</th>
                  <th className="py-2.5 px-3 uppercase text-on-surface-variant font-medium">REMORQUE</th>
                  {/* Colonnes masquées sur mobile (< md) car détaillées dans l'accordéon */}
                  <th className="hidden md:table-cell py-2.5 px-3 uppercase text-on-surface-variant font-medium">TYPE</th>
                  <th className="py-2.5 px-3 uppercase text-on-surface-variant font-medium">STATUT</th>
                  <th className="hidden md:table-cell py-2.5 px-3 uppercase text-on-surface-variant font-medium text-right">
                    KILOMÉTRAGE
                  </th>
                  <th className="py-2.5 px-3 uppercase text-on-surface-variant font-medium text-center">
                    <span className="hidden md:inline">ACTIONS</span>
                    <span className="md:hidden">DÉTAIL</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/40 font-mono">
                {filteredCouplings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                      Aucun attelage ne correspond aux critères de recherche.
                    </td>
                  </tr>
                ) : (
                  filteredCouplings.map((row) => {
                    const isBreakdown =
                      row.tractorStatus === 'breakdown' || row.trailerStatus === 'breakdown';
                    const isMaintenance =
                      row.tractorStatus === 'maintenance' || row.trailerStatus === 'maintenance';

                    const oilDue =
                      row.nextOilChangeKm != null &&
                      row.mileageKm != null &&
                      row.nextOilChangeKm - row.mileageKm <= 5000;

                    const isExpanded = expandedRowIds.has(row.id);

                    return (
                      <React.Fragment key={row.id}>
                        <tr
                          onClick={() => toggleRowExpanded(row.id)}
                          className={`transition-colors cursor-pointer md:cursor-default ${
                            isExpanded ? 'bg-surface-container-high/60' : 'hover:bg-surface-variant/30 bg-surface'
                          }`}
                        >
                          {/* N° Ordre */}
                          <td className="py-2.5 px-3 text-[#ffb77d] font-semibold whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="md:hidden text-on-surface-variant">
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-[#ff8c00]" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </span>
                              <span>{row.orderNumber}</span>
                            </div>
                          </td>

                          {/* Tracteur */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 font-semibold text-on-surface">
                              <span>{row.tractorPlate}</span>
                              {row.tractorStatus === 'breakdown' && (
                                <span className="px-1 py-0.2 rounded bg-red-950/60 text-red-400 border border-red-500/40 text-[9px] font-normal" title="Tracteur en panne">
                                  Panne
                                </span>
                              )}
                            </div>
                            {row.tractorBrandModel && (
                              <div className="text-[10px] text-on-surface-variant font-sans truncate max-w-[110px] sm:max-w-none">
                                {row.tractorBrandModel}
                              </div>
                            )}
                          </td>

                          {/* Remorque */}
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 font-semibold text-on-surface">
                              <span>{row.trailerPlate}</span>
                              {row.trailerStatus === 'breakdown' && (
                                <span className="px-1 py-0.2 rounded bg-red-950/60 text-red-400 border border-red-500/40 text-[9px] font-normal" title="Remorque en panne">
                                  Panne
                                </span>
                              )}
                            </div>
                            {row.driverName ? (
                              <div className="text-[10px] text-on-surface-variant font-sans truncate max-w-[110px] sm:max-w-none">
                                {row.driverName}
                              </div>
                            ) : (
                              <div className="md:hidden text-[9px] text-on-surface-variant/60 uppercase">
                                {row.trailerType}
                              </div>
                            )}
                          </td>

                          {/* Type Remorque (Desktop uniquement) */}
                          <td className="hidden md:table-cell py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-surface-container-high border border-[#334155] text-[10px] text-on-surface-variant uppercase">
                              {row.trailerType}
                            </span>
                          </td>

                          {/* Statut */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {isBreakdown ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/40 text-[#ffb4ab] border border-red-500/40 text-[10px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab]"></span>
                                <span>Panne</span>
                              </span>
                            ) : isMaintenance ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-500/40 text-[10px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-300"></span>
                                <span>Maint.</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/40 text-[#4edea3] border border-emerald-500/40 text-[10px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span>
                                <span>Service</span>
                              </span>
                            )}
                          </td>

                          {/* Kilométrage (Desktop uniquement) */}
                          <td className="hidden md:table-cell py-2.5 px-3 text-right whitespace-nowrap">
                            <div>{(row.mileageKm ?? 0).toLocaleString()} km</div>
                            {oilDue && (
                              <span className="text-[10px] text-amber-400 font-sans block">
                                ⚠️ Vidange requise
                              </span>
                            )}
                          </td>

                          {/* Actions (Desktop: sélecteur + unlink direct ; Mobile: bouton déplier/action) */}
                          <td
                            className="py-2.5 px-3 text-center whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Version Desktop md+ */}
                            <div className="hidden md:flex items-center justify-center gap-1.5">
                              {can('fleet:manage') && (
                                <select
                                  value={
                                    row.tractorStatus === 'breakdown' || row.trailerStatus === 'breakdown'
                                      ? 'breakdown'
                                      : row.tractorStatus === 'maintenance' || row.trailerStatus === 'maintenance'
                                      ? 'maintenance'
                                      : 'in_service'
                                  }
                                  onChange={(e) =>
                                    handleStatusChangeRequest(
                                      row,
                                      e.target.value as VehicleStatus
                                    )
                                  }
                                  aria-label={`Statut de l'attelage ${row.orderNumber}`}
                                  className="bg-[#020617] border border-[#334155] rounded text-[10px] text-on-surface-variant py-0.5 px-1 focus:outline-none focus:border-[#ff8c00]"
                                >
                                  <option value="in_service">En Service</option>
                                  <option value="breakdown">En Panne</option>
                                  <option value="maintenance">Maintenance</option>
                                </select>
                              )}

                              {can('couplings:change') && (
                                <button
                                  type="button"
                                  onClick={() => handleUncouple(row.id)}
                                  className="p-1 rounded hover:bg-surface-variant text-on-surface-variant hover:text-red-400 transition-colors"
                                  title="Désatteler"
                                  aria-label={`Désatteler l'attelage ${row.orderNumber} (${row.tractorPlate} et ${row.trailerPlate})`}
                                >
                                  <Unlink className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            {/* Version Mobile < md : Toggle Accordéon accessible */}
                            <div className="md:hidden flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => toggleRowExpanded(row.id)}
                                className={`p-1.5 rounded transition-colors flex items-center gap-1 text-[11px] ${
                                  isExpanded
                                    ? 'bg-[#ff8c00]/20 text-[#ffb77d]'
                                    : 'hover:bg-surface-variant text-on-surface-variant'
                                }`}
                                aria-label={`${isExpanded ? 'Masquer' : 'Afficher'} les détails et actions de ${row.orderNumber}`}
                                aria-expanded={isExpanded}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronDown className="w-4 h-4 text-[#ff8c00]" />
                                    <span className="font-sans font-medium text-[10px]">Fermer</span>
                                  </>
                                ) : (
                                  <>
                                    <ChevronRight className="w-4 h-4" />
                                    <span className="font-sans font-medium text-[10px]">Actions</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Accordéon Dépliable sur Mobile (< md) */}
                        {isExpanded && (
                          <tr className="md:hidden bg-[#020617]/95 border-y border-[#334155]">
                            <td colSpan={5} className="p-3">
                              <div className="flex flex-col gap-3 font-mono text-xs">
                                {/* Détails complémentaires */}
                                <div className="grid grid-cols-2 gap-2 bg-surface-container border border-[#334155]/60 rounded p-2.5 text-[11px]">
                                  <div>
                                    <span className="text-on-surface-variant block text-[10px]">TYPE REMORQUE</span>
                                    <span className="font-bold text-on-surface">{row.trailerType}</span>
                                  </div>
                                  <div>
                                    <span className="text-on-surface-variant block text-[10px]">CHAUFFEUR</span>
                                    <span className="font-bold text-on-surface">
                                      {row.driverName || 'Non assigné'}
                                    </span>
                                  </div>
                                  <div className="col-span-2 pt-1 border-t border-[#334155]/50 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-on-surface-variant">
                                      <Gauge className="w-3.5 h-3.5 text-primary" />
                                      <span>{(row.mileageKm ?? 0).toLocaleString()} km</span>
                                    </div>
                                    {oilDue && (
                                      <span className="text-[10px] text-amber-400 font-sans font-medium bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30">
                                        ⚠️ Vidange requise
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Actions Mobile avec libellés complets */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                                  {can('fleet:manage') && (
                                    <div className="flex-1 flex flex-col gap-1">
                                      <label
                                        htmlFor={`acc-status-${row.id}`}
                                        className="text-[10px] uppercase text-on-surface-variant"
                                      >
                                        Changer le statut :
                                      </label>
                                      <select
                                        id={`acc-status-${row.id}`}
                                        value={
                                          row.tractorStatus === 'breakdown' || row.trailerStatus === 'breakdown'
                                            ? 'breakdown'
                                            : row.tractorStatus === 'maintenance' || row.trailerStatus === 'maintenance'
                                            ? 'maintenance'
                                            : 'in_service'
                                        }
                                        onChange={(e) =>
                                          handleStatusChangeRequest(
                                            row,
                                            e.target.value as VehicleStatus
                                          )
                                        }
                                        className="w-full bg-[#0b1326] border border-[#334155] rounded py-2 px-2.5 font-mono text-xs text-on-surface focus:outline-none focus:border-[#ff8c00]"
                                      >
                                        <option value="in_service">En Service</option>
                                        <option value="breakdown">En Panne</option>
                                        <option value="maintenance">Maintenance</option>
                                      </select>
                                    </div>
                                  )}

                                  {can('couplings:change') && (
                                    <button
                                      type="button"
                                      onClick={() => handleUncouple(row.id)}
                                      className="flex items-center justify-center gap-2 py-2 px-3 rounded border border-red-500/40 text-red-400 hover:bg-red-950/40 hover:text-red-300 font-mono text-xs transition-colors shrink-0 self-end sm:self-auto w-full sm:w-auto"
                                      aria-label={`Désatteler l'attelage ${row.orderNumber}`}
                                    >
                                      <Unlink className="w-4 h-4" />
                                      <span className="font-medium">Désatteler l'attelage</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vue Onglet 2 : Véhicules Disponibles (Libres) */}
      {activeTab === 'unassigned' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Tracteurs libres */}
          <div className="bg-surface border border-[#334155] rounded p-4 flex flex-col gap-3">
            <h2 className="font-mono text-sm font-bold text-on-surface flex items-center justify-between">
              <span>Tracteurs Disponibles ({freeTractors.length})</span>
              <Truck className="w-4 h-4 text-primary" />
            </h2>
            <div className="divide-y divide-[#334155]/40 max-h-96 overflow-y-auto">
              {freeTractors.length === 0 ? (
                <p className="text-xs text-on-surface-variant py-4 text-center">
                  Tous les tracteurs sont actuellement attelés.
                </p>
              ) : (
                freeTractors.map((t) => (
                  <div key={t.id} className="py-2 flex items-center justify-between font-mono text-xs">
                    <div>
                      <span className="font-bold text-on-surface">{t.plateNumber}</span>
                      <span className="text-on-surface-variant ml-2 text-[11px]">
                        {t.brandModel || 'Tracteur'} — {t.mileageKm.toLocaleString()} km
                      </span>
                    </div>
                    {can('couplings:change') && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreselectedTractorId(t.id);
                          setPreselectedTrailerId(undefined);
                          setIsCouplingModalOpen(true);
                        }}
                        className="px-2 py-1 rounded bg-[#ff8c00]/20 text-[#ffb77d] hover:bg-[#ff8c00]/30 border border-[#ff8c00]/40 text-[10px]"
                      >
                        Atteler
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Remorques libres */}
          <div className="bg-surface border border-[#334155] rounded p-4 flex flex-col gap-3">
            <h2 className="font-mono text-sm font-bold text-on-surface flex items-center justify-between">
              <span>Remorques Disponibles ({freeTrailers.length})</span>
              <Truck className="w-4 h-4 text-[#4edea3]" />
            </h2>
            <div className="divide-y divide-[#334155]/40 max-h-96 overflow-y-auto">
              {freeTrailers.length === 0 ? (
                <p className="text-xs text-on-surface-variant py-4 text-center">
                  Toutes les remorques sont actuellement attelées.
                </p>
              ) : (
                freeTrailers.map((tr) => (
                  <div key={tr.id} className="py-2 flex items-center justify-between font-mono text-xs">
                    <div>
                      <span className="font-bold text-on-surface">{tr.plateNumber}</span>
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-surface-container border border-[#334155] text-[10px] text-on-surface-variant">
                        {tr.trailerType}
                      </span>
                    </div>
                    {can('couplings:change') && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreselectedTrailerId(tr.id);
                          setPreselectedTractorId(undefined);
                          setIsCouplingModalOpen(true);
                        }}
                        className="px-2 py-1 rounded bg-[#4edea3]/20 text-[#4edea3] hover:bg-[#4edea3]/30 border border-[#4edea3]/40 text-[10px]"
                      >
                        Atteler
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modale d'Attelage */}
      {isCouplingModalOpen && (
        <CouplingModal
          isOpen={isCouplingModalOpen}
          onClose={() => setIsCouplingModalOpen(false)}
          tractors={data?.tractors || []}
          trailers={data?.trailers || []}
          onSuccess={loadFleet}
          initialTractorId={preselectedTractorId}
          initialTrailerId={preselectedTrailerId}
        />
      )}

      {/* Modale de Désattelage */}
      {uncoupleTarget && (
        <UncoupleModal
          isOpen={!!uncoupleTarget}
          onClose={() => setUncoupleTarget(null)}
          couplingId={uncoupleTarget.id}
          couplingLabel={uncoupleTarget.label}
          onSuccess={loadFleet}
        />
      )}

      {/* Modale de Déclaration de Panne */}
      {breakdownTarget && (
        <BreakdownModal
          isOpen={!!breakdownTarget}
          onClose={() => setBreakdownTarget(null)}
          coupling={breakdownTarget}
          categories={data?.breakdownCategories || []}
          onSuccess={loadFleet}
        />
      )}

      {/* Modale d'Ajout Rapide de Véhicule */}
      {isAddVehicleOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddVehicleOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-surface border border-[#334155] rounded-xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-surface-container border-b border-[#334155] flex justify-between items-center">
              <h2 className="font-mono text-sm font-bold text-on-surface flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                <span>Ajouter un Véhicule à la Flotte</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsAddVehicleOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddVehicle} className="p-5 flex flex-col gap-4 font-mono text-xs">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVehicleKind('tractor')}
                  className={`flex-1 py-2 rounded text-center transition-colors ${
                    vehicleKind === 'tractor'
                      ? 'bg-[#ff8c00] text-black font-semibold'
                      : 'bg-[#020617] border border-[#334155] text-on-surface-variant'
                  }`}
                >
                  Tracteur
                </button>
                <button
                  type="button"
                  onClick={() => setVehicleKind('trailer')}
                  className={`flex-1 py-2 rounded text-center transition-colors ${
                    vehicleKind === 'trailer'
                      ? 'bg-[#ff8c00] text-black font-semibold'
                      : 'bg-[#020617] border border-[#334155] text-on-surface-variant'
                  }`}
                >
                  Remorque
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="uppercase text-on-surface">Immatriculation (Plaque)</label>
                <input
                  type="text"
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value)}
                  placeholder="Ex: 5895 CAT"
                  required
                  className="bg-[#020617] border border-[#334155] rounded py-2 px-3 text-on-surface focus:outline-none focus:border-[#ff8c00]"
                />
              </div>

              {vehicleKind === 'tractor' ? (
                <div className="flex flex-col gap-1.5">
                  <label className="uppercase text-on-surface">Marque / Modèle</label>
                  <input
                    type="text"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="Ex: RENAULT T-HIGH 520"
                    className="bg-[#020617] border border-[#334155] rounded py-2 px-3 text-on-surface focus:outline-none focus:border-[#ff8c00]"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="uppercase text-on-surface">Type de Remorque</label>
                  <select
                    value={newTrailerType}
                    onChange={(e) => setNewTrailerType(e.target.value as TrailerType)}
                    className="bg-[#020617] border border-[#334155] rounded py-2 px-3 text-on-surface focus:outline-none focus:border-[#ff8c00]"
                  >
                    <option value="BENNE">BENNE</option>
                    <option value="PLATEAU">PLATEAU</option>
                    <option value="CITERNE">CITERNE</option>
                    <option value="FRIGO">FRIGO</option>
                    <option value="AUTRE">AUTRE</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsAddVehicleOpen(false)}
                  className="px-3 py-1.5 border border-[#334155] rounded hover:bg-surface-variant"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-semibold rounded"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
