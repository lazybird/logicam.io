import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Wrench, Truck, Loader2, Unlink } from 'lucide-react';
import { api } from '../lib/api';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { SearchableSelect } from './SearchableSelect';
import type { BreakdownCategoryDTO, GarageDTO, VehicleStatus } from '../../shared/types';
import type { BreakdownTargetPayload, BreakdownTargetScope } from './BreakdownModal';

export type StatusChangeModalTarget = BreakdownTargetPayload;

interface StatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: StatusChangeModalTarget | null;
  initialScope?: BreakdownTargetScope;
  initialAction?: VehicleStatus;
  categories: BreakdownCategoryDTO[];
  garages: GarageDTO[];
  onSuccess: () => void;
  onCategoryCreated?: (newCategory: BreakdownCategoryDTO) => void;
}

export const StatusChangeModal: React.FC<StatusChangeModalProps> = ({
  isOpen,
  onClose,
  target,
  initialScope = 'both',
  initialAction = 'in_service',
  categories: initialCategories,
  garages,
  onSuccess,
  onCategoryCreated,
}) => {
  const [selectedAction, setSelectedAction] = useState<VehicleStatus>(initialAction);
  const [targetScope, setTargetScope] = useState<BreakdownTargetScope>(initialScope);

  // Catégories locales enrichissables à la volée
  const [localCategories, setLocalCategories] = useState<BreakdownCategoryDTO[]>(initialCategories);

  // Panne : Support multi-pannes
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // Maintenance : Support multi-sujets de maintenance harmonisés
  const [selectedMaintenanceSubjectIds, setSelectedMaintenanceSubjectIds] = useState<string[]>([]);
  const [selectedGarageId, setSelectedGarageId] = useState<string>('');

  // Commun
  const [notes, setNotes] = useState('');
  const [uncoupleImmediately, setUncoupleImmediately] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(isOpen, onClose);

  React.useEffect(() => {
    setLocalCategories(initialCategories);
  }, [initialCategories]);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedAction(initialAction);
      setTargetScope(initialScope);
      setSelectedCategoryIds([]);
      setSelectedMaintenanceSubjectIds([]);
      setSelectedGarageId('');
      setNotes('');
      setUncoupleImmediately(false);
      setError(null);
    }
  }, [isOpen, initialAction, initialScope, target]);

  if (!isOpen || !target) return null;

  const isCoupling = target.kind === 'coupling';

  // Séparation des catégories de pannes et sujets de maintenance
  const breakdownCategoryOptions = localCategories.filter(
    (c) => !c.categoryType || c.categoryType === 'breakdown'
  );

  const maintenanceSubjectOptions = localCategories.filter(
    (c) => c.categoryType === 'maintenance'
  );

  // Création rapide à la volée d'une panne
  const handleCreateBreakdownCategory = async (name: string): Promise<string | void> => {
    try {
      const created = await api.post<BreakdownCategoryDTO>('/api/admin/categories', {
        name,
        categoryType: 'breakdown',
        severity: 'high',
      });
      setLocalCategories((prev) => [...prev, created]);
      if (onCategoryCreated) onCategoryCreated(created);
      return created.id;
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création de la catégorie de panne');
    }
  };

  // Création rapide à la volée d'un sujet de maintenance
  const handleCreateMaintenanceSubject = async (name: string): Promise<string | void> => {
    try {
      const created = await api.post<BreakdownCategoryDTO>('/api/admin/categories', {
        name,
        categoryType: 'maintenance',
        severity: 'medium',
      });
      setLocalCategories((prev) => [...prev, created]);
      if (onCategoryCreated) onCategoryCreated(created);
      return created.id;
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création du sujet de maintenance');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (selectedAction === 'in_service') {
        // Remise en service direct
        if (isCoupling) {
          const patches: Promise<any>[] = [];
          if (targetScope === 'tractor' || targetScope === 'both') {
            patches.push(api.patch(`/api/fleet/tractors/${target.tractorId}`, { status: 'in_service' }));
          }
          if (targetScope === 'trailer' || targetScope === 'both') {
            patches.push(api.patch(`/api/fleet/trailers/${target.trailerId}`, { status: 'in_service' }));
          }
          await Promise.all(patches);
        } else {
          const endpoint =
            target.vehicleType === 'tractor'
              ? `/api/fleet/tractors/${target.id}`
              : `/api/fleet/trailers/${target.id}`;
          await api.patch(endpoint, { status: 'in_service' });
        }
      } else if (selectedAction === 'breakdown') {
        // Déclaration de panne (multi-pannes supporté)
        const payload: any = {
          type: 'breakdown',
          categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
          categoryId: selectedCategoryIds[0] || null,
          notes: notes.trim() || null,
        };

        if (isCoupling) {
          payload.tractorId = targetScope === 'tractor' || targetScope === 'both' ? target.tractorId : null;
          payload.trailerId = targetScope === 'trailer' || targetScope === 'both' ? target.trailerId : null;
          payload.couplingId = target.id;
          payload.uncoupleImmediately = uncoupleImmediately;
        } else {
          payload.tractorId = target.vehicleType === 'tractor' ? target.id : null;
          payload.trailerId = target.vehicleType === 'trailer' ? target.id : null;
        }

        await api.post('/api/fleet/incidents', payload);
      } else if (selectedAction === 'maintenance') {
        // Déclaration de maintenance (multi-sujets de maintenance supporté)
        const selectedSubjectNames = maintenanceSubjectOptions
          .filter((s) => selectedMaintenanceSubjectIds.includes(s.id))
          .map((s) => s.name);

        const topicsHeader = selectedSubjectNames.length > 0
          ? `[${selectedSubjectNames.join(', ')}]`
          : '[Maintenance générale]';

        const combinedNotes = notes.trim()
          ? `${topicsHeader} ${notes.trim()}`
          : topicsHeader;

        const payload: any = {
          type: 'maintenance',
          categoryIds: selectedMaintenanceSubjectIds.length > 0 ? selectedMaintenanceSubjectIds : undefined,
          categoryId: selectedMaintenanceSubjectIds[0] || null,
          garageId: selectedGarageId || null,
          notes: combinedNotes,
        };

        if (isCoupling) {
          payload.tractorId = targetScope === 'tractor' || targetScope === 'both' ? target.tractorId : null;
          payload.trailerId = targetScope === 'trailer' || targetScope === 'both' ? target.trailerId : null;
          payload.couplingId = target.id;
          payload.uncoupleImmediately = uncoupleImmediately;
        } else {
          payload.tractorId = target.vehicleType === 'tractor' ? target.id : null;
          payload.trailerId = target.vehicleType === 'trailer' ? target.id : null;
        }

        await api.post('/api/fleet/incidents', payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la mise à jour du statut');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-surface border border-[#334155] rounded-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* En-tête */}
        <div className="p-4 bg-surface-container border-b border-[#334155] flex justify-between items-center">
          <div>
            <h2 className="font-mono text-sm font-bold text-on-surface">
              Changer le statut & déclarer une intervention
            </h2>
            <p className="font-mono text-xs text-[#ffb77d]">
              {isCoupling
                ? `Attelage ${target.orderNumber} (${target.tractorPlate} + ${target.trailerPlate})`
                : `${target.vehicleType === 'tractor' ? 'Tracteur' : 'Remorque'} ${target.plateNumber}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors"
            aria-label="Fermer la modale"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 font-mono text-xs">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Choix du nouvel état */}
          <div className="flex flex-col gap-1.5">
            <label className="text-on-surface-variant uppercase font-medium text-[11px] tracking-wider">
              Nouvel état souhaité *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedAction('in_service')}
                className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${
                  selectedAction === 'in_service'
                    ? 'bg-emerald-950/70 border-emerald-500 text-[#4edea3] ring-1 ring-emerald-500 font-semibold'
                    : 'bg-surface-container border-[#334155] text-on-surface-variant hover:border-emerald-500/40'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs">En Service</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAction('breakdown')}
                className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${
                  selectedAction === 'breakdown'
                    ? 'bg-red-950/70 border-red-500 text-red-300 ring-1 ring-red-500 font-semibold'
                    : 'bg-surface-container border-[#334155] text-on-surface-variant hover:border-red-500/40'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs">En Panne</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAction('maintenance')}
                className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${
                  selectedAction === 'maintenance'
                    ? 'bg-amber-950/70 border-amber-500 text-amber-300 ring-1 ring-amber-500 font-semibold'
                    : 'bg-surface-container border-[#334155] text-on-surface-variant hover:border-amber-500/40'
                }`}
              >
                <Wrench className="w-4 h-4 text-amber-400" />
                <span className="text-xs">Maintenance</span>
              </button>
            </div>
          </div>

          {/* 2. Périmètre d'application (si attelage) */}
          {isCoupling && (
            <div className="flex flex-col gap-1.5">
              <label className="text-on-surface-variant uppercase font-medium text-[11px] tracking-wider">
                Élément concerné *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetScope('tractor')}
                  className={`p-2.5 rounded-lg border flex flex-col items-center text-center gap-1 transition-all ${
                    targetScope === 'tractor'
                      ? 'bg-primary-container/20 border-primary text-primary font-semibold ring-1 ring-primary'
                      : 'bg-surface-container border-[#334155] text-on-surface-variant hover:border-primary/40'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Tracteur seul</span>
                  <span className="text-[10px] text-on-surface-variant truncate w-full">
                    {target.tractorPlate}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetScope('trailer')}
                  className={`p-2.5 rounded-lg border flex flex-col items-center text-center gap-1 transition-all ${
                    targetScope === 'trailer'
                      ? 'bg-primary-container/20 border-primary text-primary font-semibold ring-1 ring-primary'
                      : 'bg-surface-container border-[#334155] text-on-surface-variant hover:border-primary/40'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Remorque seule</span>
                  <span className="text-[10px] text-on-surface-variant truncate w-full">
                    {target.trailerPlate}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetScope('both')}
                  className={`p-2.5 rounded-lg border flex flex-col items-center text-center gap-1 transition-all ${
                    targetScope === 'both'
                      ? 'bg-primary-container/20 border-primary text-primary font-semibold ring-1 ring-primary'
                      : 'bg-surface-container border-[#334155] text-on-surface-variant hover:border-primary/40'
                  }`}
                >
                  <span className="text-[11px] font-bold">2 / 2</span>
                  <span className="text-[11px]">Les deux</span>
                  <span className="text-[10px] text-on-surface-variant truncate w-full">
                    Ensemble complet
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 3. Détails spécifiques si Panne (Multi-pannes + Création à la volée) */}
          {selectedAction === 'breakdown' && (
            <div className="flex flex-col gap-3 pt-1 border-t border-[#334155]/60">
              <SearchableSelect
                label="Anomalies / Pannes constatées (sélection multiple)"
                placeholder="Sélectionner une ou plusieurs pannes..."
                emptyMessage="Aucune anomalie correspondante"
                multiple
                values={selectedCategoryIds}
                onMultiChange={(vals) => setSelectedCategoryIds(vals)}
                value=""
                onChange={() => {}}
                allowCreate
                createLabel="Ajouter cette nouvelle panne au catalogue"
                onCreateNew={handleCreateBreakdownCategory}
                options={breakdownCategoryOptions.map((cat) => {
                  const severityUpper = (cat.severity || 'medium').toUpperCase();
                  const badgeColor =
                    severityUpper === 'CRITICAL'
                      ? 'red'
                      : severityUpper === 'HIGH'
                      ? 'amber'
                      : severityUpper === 'LOW'
                      ? 'emerald'
                      : 'blue';

                  return {
                    id: cat.id,
                    label: cat.name,
                    badge: severityUpper,
                    badgeColor,
                    subLabel: cat.description || `Code: ${cat.code}`,
                  };
                })}
              />

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="status-modal-notes"
                  className="block text-on-surface-variant font-medium uppercase text-[11px] tracking-wider"
                >
                  Précisions / Circonstances (optionnel)
                </label>
                <textarea
                  id="status-modal-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Pneu crevé essieu 2 droit + voyant ABS allumé, véhicule immobilisé au dépôt..."
                  className="w-full bg-[#020617] border border-[#334155] rounded-lg p-2.5 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-red-500 transition-colors resize-none"
                />
              </div>

              {isCoupling && (
                <label className="flex items-start gap-3 p-3 rounded-lg border border-[#334155] bg-surface-container cursor-pointer hover:border-red-500/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={uncoupleImmediately}
                    onChange={(e) => setUncoupleImmediately(e.target.checked)}
                    className="mt-0.5 rounded border-[#334155] text-red-500 focus:ring-0 focus:outline-none bg-[#020617] w-4 h-4 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                      <Unlink className="w-3.5 h-3.5 text-red-400" />
                      Désatteler immédiatement l'ensemble
                    </span>
                    <p className="font-sans text-[11px] text-on-surface-variant mt-0.5">
                      Libère le véhicule sain pour qu'il puisse être réattelé de suite.
                    </p>
                  </div>
                </label>
              )}
            </div>
          )}

          {/* 4. Détails spécifiques si Maintenance (Multi-sujets harmonisés + Création à la volée + Garage) */}
          {selectedAction === 'maintenance' && (
            <div className="flex flex-col gap-3 pt-1 border-t border-[#334155]/60">
              <SearchableSelect
                label="Sujets / Opérations de maintenance (sélection multiple)"
                placeholder="Sélectionner les opérations à réaliser..."
                emptyMessage="Aucun sujet de maintenance correspondant"
                multiple
                values={selectedMaintenanceSubjectIds}
                onMultiChange={(vals) => setSelectedMaintenanceSubjectIds(vals)}
                value=""
                onChange={() => {}}
                allowCreate
                createLabel="Ajouter ce nouveau sujet de maintenance"
                onCreateNew={handleCreateMaintenanceSubject}
                options={maintenanceSubjectOptions.map((s) => ({
                  id: s.id,
                  label: s.name,
                  subLabel: s.description || `Code: ${s.code}`,
                  badge: (s.severity || 'medium').toUpperCase(),
                  badgeColor: s.severity === 'critical' ? 'red' : s.severity === 'high' ? 'amber' : 'blue',
                }))}
              />

              {garages.length > 0 && (
                <SearchableSelect
                  label="Garage / Prestataire assigné (optionnel)"
                  placeholder="Sélectionner un atelier partenaire..."
                  emptyMessage="Aucun garage trouvé"
                  options={garages.map((g) => ({
                    id: g.id,
                    label: g.name,
                    subLabel: g.contactPhone || g.location || undefined,
                  }))}
                  value={selectedGarageId}
                  onChange={(val) => setSelectedGarageId(val)}
                />
              )}

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="maintenance-modal-notes"
                  className="block text-on-surface-variant font-medium uppercase text-[11px] tracking-wider"
                >
                  Consignes / Travaux supplémentaires
                </label>
                <textarea
                  id="maintenance-modal-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Remplacement filtre gasoil + contrôle pression pneumatiques..."
                  className="w-full bg-[#020617] border border-[#334155] rounded-lg p-2.5 text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>

              {isCoupling && (
                <label className="flex items-start gap-3 p-3 rounded-lg border border-[#334155] bg-surface-container cursor-pointer hover:border-amber-500/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={uncoupleImmediately}
                    onChange={(e) => setUncoupleImmediately(e.target.checked)}
                    className="mt-0.5 rounded border-[#334155] text-amber-500 focus:ring-0 focus:outline-none bg-[#020617] w-4 h-4 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                      <Unlink className="w-3.5 h-3.5 text-amber-400" />
                      Désatteler immédiatement l'ensemble
                    </span>
                    <p className="font-sans text-[11px] text-on-surface-variant mt-0.5">
                      Libère l'autre véhicule pendant l'intervention.
                    </p>
                  </div>
                </label>
              )}
            </div>
          )}

          {/* 5. Message explicatif si Remise en service */}
          {selectedAction === 'in_service' && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {isCoupling
                  ? targetScope === 'both'
                    ? "L'ensemble sera marqué disponible et opérationnel."
                    : targetScope === 'tractor'
                    ? 'Le tracteur sera remis en service opérationnel.'
                    : 'La remorque sera remise en service opérationnelle.'
                  : 'Le véhicule sera remis en service et disponible au parc.'}
              </span>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#334155]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-[#334155] hover:bg-surface-variant text-on-surface-variant font-mono text-xs transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-lg text-white font-mono text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-50 ${
                selectedAction === 'breakdown'
                  ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-950/40'
                  : selectedAction === 'maintenance'
                  ? 'bg-amber-600 hover:bg-amber-500 text-black font-semibold shadow-lg shadow-amber-950/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/40'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : selectedAction === 'breakdown' ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>
                    Confirmer {selectedCategoryIds.length > 1 ? `${selectedCategoryIds.length} pannes` : 'la panne'}
                  </span>
                </>
              ) : selectedAction === 'maintenance' ? (
                <>
                  <Wrench className="w-4 h-4" />
                  <span>
                    Confirmer {selectedMaintenanceSubjectIds.length > 1 ? `${selectedMaintenanceSubjectIds.length} sujets` : 'la maintenance'}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Remettre en service</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
