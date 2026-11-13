import React, { useState } from 'react';
import { X, Wrench, Truck, Loader2, Unlink } from 'lucide-react';
import { api } from '../lib/api';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { SearchableSelect } from './SearchableSelect';
import type { GarageDTO, VehicleStatus } from '../../shared/types';
import type { BreakdownTargetPayload, BreakdownTargetScope } from './BreakdownModal';

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: BreakdownTargetPayload | null;
  initialScope?: BreakdownTargetScope;
  garages: GarageDTO[];
  onSuccess: () => void;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  isOpen,
  onClose,
  target,
  initialScope = 'tractor',
  garages,
  onSuccess,
}) => {
  const [targetScope, setTargetScope] = useState<BreakdownTargetScope>(initialScope);
  const [selectedGarageId, setSelectedGarageId] = useState<string>('');
  const [maintenanceType, setMaintenanceType] = useState<'vidange' | 'revision' | 'pneus' | 'autre'>('vidange');
  const [uncoupleImmediately, setUncoupleImmediately] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronise le scope quand la modale s'ouvre ou que target/initialScope change
  React.useEffect(() => {
    if (isOpen) {
      setTargetScope(initialScope);
      setSelectedGarageId('');
      setMaintenanceType('vidange');
      setUncoupleImmediately(false);
      setNotes('');
      setError(null);
    }
  }, [isOpen, initialScope, target]);

  useEscapeKey(isOpen, onClose);

  if (!isOpen || !target) return null;

  const isCoupling = target.kind === 'coupling';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
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

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors du passage en maintenance');
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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-on-surface">
                Placer en Maintenance / Atelier
              </h2>
              <p className="font-mono text-xs text-[#ffb77d]">
                {isCoupling
                  ? `Attelage ${target.orderNumber}`
                  : `${target.vehicleType === 'tractor' ? 'Tracteur' : 'Remorque'} ${target.plateNumber}`}
              </p>
            </div>
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
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-lg text-xs font-mono text-red-300 flex items-center gap-2">
              <span>{error}</span>
            </div>
          )}

          {/* Choix de l'élément concerné (uniquement pour un attelage) */}
          {isCoupling && (
            <div className="flex flex-col gap-2">
              <label className="block font-mono text-xs text-on-surface-variant font-medium uppercase tracking-wider">
                Quel élément entre en maintenance ? *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetScope('tractor')}
                  className={`p-3 rounded-lg border font-mono text-xs flex flex-col items-center gap-1.5 text-center transition-all ${
                    targetScope === 'tractor'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500 font-semibold'
                      : 'bg-surface-container border-[#334155] text-on-surface-variant hover:border-amber-400/50'
                  }`}
                >
                  <Truck className="w-4 h-4 text-primary" />
                  <span className="text-[11px]">Tracteur seul</span>
                  <span className="text-[10px] text-on-surface-variant truncate w-full">
                    {target.tractorPlate}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetScope('trailer')}
                  className={`p-3 rounded-lg border font-mono text-xs flex flex-col items-center gap-1.5 text-center transition-all ${
                    targetScope === 'trailer'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500 font-semibold'
                      : 'bg-surface-container border-[#334155] text-on-surface-variant hover:border-amber-400/50'
                  }`}
                >
                  <Truck className="w-4 h-4 text-[#4edea3]" />
                  <span className="text-[11px]">Remorque seule</span>
                  <span className="text-[10px] text-on-surface-variant truncate w-full">
                    {target.trailerPlate}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetScope('both')}
                  className={`p-3 rounded-lg border font-mono text-xs flex flex-col items-center gap-1.5 text-center transition-all ${
                    targetScope === 'both'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500 font-semibold'
                      : 'bg-surface-container border-[#334155] text-on-surface-variant hover:border-amber-400/50'
                  }`}
                >
                  <Wrench className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px]">Les deux</span>
                  <span className="text-[10px] text-on-surface-variant truncate w-full">
                    Ensemble complet
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Renseignement du véhicule isolé */}
          {!isCoupling && (
            <div className="p-3 bg-surface-container border border-[#334155] rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs">
                <Truck
                  className={`w-4 h-4 ${
                    target.vehicleType === 'tractor' ? 'text-primary' : 'text-[#4edea3]'
                  }`}
                />
                <span className="font-bold text-on-surface">{target.plateNumber}</span>
                {target.label && (
                  <span className="text-on-surface-variant text-[11px]">
                    ({target.label})
                  </span>
                )}
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-[#334155] uppercase font-mono">
                {target.vehicleType === 'tractor' ? 'Tracteur libre' : 'Remorque libre'}
              </span>
            </div>
          )}

          {/* Type d'opération (SearchableSelect harmonisé) */}
          <SearchableSelect
            label="Motif de maintenance"
            required
            placeholder="Sélectionner le motif..."
            options={[
              {
                id: 'vidange',
                label: 'Vidange périodique',
                subLabel: 'Moteur & filtres',
                badge: 'RÉVISION',
                badgeColor: 'blue',
              },
              {
                id: 'revision',
                label: 'Révision générale',
                subLabel: 'Contrôle technique & organes',
                badge: 'ATELIER',
                badgeColor: 'amber',
              },
              {
                id: 'pneus',
                label: 'Pneumatiques',
                subLabel: 'Changement ou permutation',
                badge: 'TRAIN',
                badgeColor: 'emerald',
              },
              {
                id: 'autre',
                label: 'Autre intervention',
                subLabel: 'Travaux préventifs ou carrosserie',
                badge: 'DIVERS',
                badgeColor: 'gray',
              },
            ]}
            value={maintenanceType}
            onChange={(val) => setMaintenanceType(val as any)}
          />

          {/* Garage partenaire (SearchableSelect harmonisé) */}
          {garages.length > 0 && (
            <SearchableSelect
              label="Garage / Atelier assigné"
              placeholder="Sélectionner un atelier..."
              emptyMessage="Aucun garage trouvé"
              options={garages.map((gar) => ({
                id: gar.id,
                label: gar.name,
                subLabel: gar.location || undefined,
                badge: gar.contactPhone ? 'TEL' : undefined,
                badgeColor: 'blue',
              }))}
              value={selectedGarageId}
              onChange={(val) => setSelectedGarageId(val)}
            />
          )}

          {/* Précisions / Notes */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="maintenance-notes"
              className="block font-mono text-xs text-on-surface-variant font-medium uppercase tracking-wider"
            >
              Précisions / Observations (optionnel)
            </label>
            <textarea
              id="maintenance-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Remplacement filtre à huile et vérification plaquettes..."
              className="w-full bg-[#020617] border border-[#334155] rounded-lg p-2.5 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          {/* Option Désatteler immédiatement (si attelé) */}
          {isCoupling && (
            <label className="flex items-start gap-3 p-3 rounded-lg border border-[#334155] bg-surface-container cursor-pointer hover:border-amber-500/50 transition-colors">
              <input
                type="checkbox"
                checked={uncoupleImmediately}
                onChange={(e) => setUncoupleImmediately(e.target.checked)}
                className="mt-0.5 rounded border-[#334155] text-amber-500 focus:ring-0 focus:outline-none bg-[#020617] w-4 h-4 cursor-pointer"
              />
              <div className="flex-1">
                <span className="font-mono text-xs font-semibold text-on-surface flex items-center gap-1.5">
                  <Unlink className="w-3.5 h-3.5 text-amber-400" />
                  Désatteler immédiatement l'ensemble
                </span>
                <p className="font-sans text-[11px] text-on-surface-variant mt-0.5">
                  Permet de libérer le véhicule qui n'est pas en révision pour un autre attelage.
                </p>
              </div>
            </label>
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
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-medium transition-colors flex items-center gap-2 shadow-lg shadow-amber-950/40 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4" />
                  <span>Confirmer la maintenance</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
