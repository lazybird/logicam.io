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
}

export const StatusChangeModal: React.FC<StatusChangeModalProps> = ({
  isOpen,
  onClose,
  target,
  initialScope = 'both',
  initialAction = 'in_service',
  categories,
  garages,
  onSuccess,
}) => {
  const [selectedAction, setSelectedAction] = useState<VehicleStatus>(initialAction);
  const [targetScope, setTargetScope] = useState<BreakdownTargetScope>(initialScope);

  // Panne
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Maintenance
  const [selectedGarageId, setSelectedGarageId] = useState<string>('');
  const [maintenanceType, setMaintenanceType] = useState<'vidange' | 'revision' | 'pneus' | 'autre'>('vidange');

  // Commun
  const [notes, setNotes] = useState('');
  const [uncoupleImmediately, setUncoupleImmediately] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(isOpen, onClose);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedAction(initialAction);
      setTargetScope(initialScope);
      setSelectedCategoryId('');
      setSelectedGarageId('');
      setMaintenanceType('vidange');
      setNotes('');
      setUncoupleImmediately(false);
      setError(null);
    }
  }, [isOpen, initialAction, initialScope, target]);

  if (!isOpen || !target) return null;

  const isCoupling = target.kind === 'coupling';

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
        // Déclaration de panne
        if (isCoupling) {
          await api.post('/api/fleet/incidents', {
            type: 'breakdown',
            tractorId: targetScope === 'tractor' || targetScope === 'both' ? target.tractorId : null,
            trailerId: targetScope === 'trailer' || targetScope === 'both' ? target.trailerId : null,
            couplingId: target.id,
            categoryId: selectedCategoryId || null,
            notes: notes.trim() || null,
            uncoupleImmediately,
          });
        } else {
          await api.post('/api/fleet/incidents', {
            type: 'breakdown',
            tractorId: target.vehicleType === 'tractor' ? target.id : null,
            trailerId: target.vehicleType === 'trailer' ? target.id : null,
            categoryId: selectedCategoryId || null,
            notes: notes.trim() || null,
          });
        }
      } else if (selectedAction === 'maintenance') {
        // Déclaration de maintenance
        const typeLabel =
          maintenanceType === 'vidange'
            ? 'Vidange moteur'
            : maintenanceType === 'revision'
            ? 'Révision périodique'
            : maintenanceType === 'pneus'
            ? 'Changement / permutation pneumatiques'
            : 'Maintenance générale';

        const combinedNotes = notes.trim()
          ? `[${typeLabel}] ${notes.trim()}`
          : `[${typeLabel}]`;

        if (isCoupling) {
          await api.post('/api/fleet/incidents', {
            type: 'maintenance',
            tractorId: targetScope === 'tractor' || targetScope === 'both' ? target.tractorId : null,
            trailerId: targetScope === 'trailer' || targetScope === 'both' ? target.trailerId : null,
            couplingId: target.id,
            garageId: selectedGarageId || null,
            notes: combinedNotes,
            uncoupleImmediately,
          });
        } else {
          await api.post('/api/fleet/incidents', {
            type: 'maintenance',
            tractorId: target.vehicleType === 'tractor' ? target.id : null,
            trailerId: target.vehicleType === 'trailer' ? target.id : null,
            garageId: selectedGarageId || null,
            notes: combinedNotes,
          });
        }
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
              Changer le statut
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

          {/* 3. Détails spécifiques si Panne */}
          {selectedAction === 'breakdown' && (
            <div className="flex flex-col gap-3 pt-1 border-t border-[#334155]/60">
              {categories.length > 0 && (
                <SearchableSelect
                  label="Type d'anomalie / Catégorie"
                  placeholder="Sélectionner une catégorie..."
                  emptyMessage="Aucune catégorie correspondante"
                  options={categories.map((cat) => {
                    const severityUpper = (cat.severity || 'medium').toUpperCase();
                    const badgeColor =
                      severityUpper === 'CRITICAL' || severityUpper === 'HIGH'
                        ? 'amber'
                        : severityUpper === 'LOW'
                        ? 'emerald'
                        : 'blue';

                    return {
                      id: cat.id,
                      label: cat.name,
                      badge: severityUpper,
                      badgeColor,
                      subLabel: `Code: ${cat.code}`,
                    };
                  })}
                  value={selectedCategoryId}
                  onChange={(val) => setSelectedCategoryId(val)}
                />
              )}

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="status-modal-notes"
                  className="block text-on-surface-variant font-medium uppercase text-[11px] tracking-wider"
                >
                  Précisions sur la panne (optionnel)
                </label>
                <textarea
                  id="status-modal-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Pneu crevé, fuite d'air comprimé, voyant moteur..."
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

          {/* 4. Détails spécifiques si Maintenance */}
          {selectedAction === 'maintenance' && (
            <div className="flex flex-col gap-3 pt-1 border-t border-[#334155]/60">
              <div className="flex flex-col gap-1.5">
                <label className="text-on-surface-variant font-medium uppercase text-[11px] tracking-wider">
                  Type d'intervention *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'vidange', label: 'Vidange' },
                      { id: 'revision', label: 'Révision' },
                      { id: 'pneus', label: 'Pneus' },
                      { id: 'autre', label: 'Autre' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setMaintenanceType(item.id)}
                      className={`p-2 rounded-lg border text-xs text-center transition-all ${
                        maintenanceType === item.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500 font-semibold'
                          : 'bg-surface-container border-[#334155] text-on-surface-variant hover:border-amber-400/40'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {garages.length > 0 && (
                <SearchableSelect
                  label="Garage / Prestataire (optionnel)"
                  placeholder="Sélectionner un garage..."
                  emptyMessage="Aucun garage trouvé"
                  options={garages.map((g) => ({
                    id: g.id,
                    label: g.name,
                    subLabel: g.phone || g.city || undefined,
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
                  Notes ou consignes
                </label>
                <textarea
                  id="maintenance-modal-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Remplacement filtre à huile + contrôle freins..."
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
                  <span>Confirmer la panne</span>
                </>
              ) : selectedAction === 'maintenance' ? (
                <>
                  <Wrench className="w-4 h-4" />
                  <span>Confirmer la maintenance</span>
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
