import React, { useState } from 'react';
import { X, Wrench, Truck, Loader2, Unlink } from 'lucide-react';
import { api } from '../lib/api';
import { useEscapeKey } from '../hooks/useEscapeKey';
import type { GarageDTO, VehicleStatus } from '../../shared/types';
import type { BreakdownTargetPayload, BreakdownTargetScope } from './BreakdownModal';

interface MaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: BreakdownTargetPayload | null;
  garages: GarageDTO[];
  onSuccess: () => void;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  isOpen,
  onClose,
  target,
  garages,
  onSuccess,
}) => {
  const [targetScope, setTargetScope] = useState<BreakdownTargetScope>('tractor');
  const [selectedGarageId, setSelectedGarageId] = useState<string>('');
  const [maintenanceType, setMaintenanceType] = useState<'vidange' | 'revision' | 'pneus' | 'autre'>('vidange');
  const [uncoupleImmediately, setUncoupleImmediately] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(isOpen, onClose);

  if (!isOpen || !target) return null;

  const isCoupling = target.kind === 'coupling';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isCoupling) {
        // 1. Mettre à jour le statut du tracteur si concerné
        if (targetScope === 'tractor' || targetScope === 'both') {
          await api.patch(`/api/fleet/tractors/${target.tractorId}`, {
            status: 'maintenance',
          });
        }

        // 2. Mettre à jour le statut de la remorque si concernée
        if (targetScope === 'trailer' || targetScope === 'both') {
          await api.patch(`/api/fleet/trailers/${target.trailerId}`, {
            status: 'maintenance',
          });
        }

        // 3. Si désattelage immédiat demandé (ex: remorque reste au dépôt pendant que tracteur est en atelier)
        if (uncoupleImmediately) {
          await api.post(`/api/fleet/couplings/${target.id}/uncouple`);
        }
      } else {
        // Véhicule isolé non attelé
        const endpoint =
          target.vehicleType === 'tractor'
            ? `/api/fleet/tractors/${target.id}`
            : `/api/fleet/trailers/${target.id}`;

        await api.patch(endpoint, {
          status: 'maintenance',
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

          {/* Type d'opération */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="maintenance-type-select"
              className="block font-mono text-xs text-on-surface-variant font-medium uppercase tracking-wider"
            >
              Motif de maintenance
            </label>
            <select
              id="maintenance-type-select"
              value={maintenanceType}
              onChange={(e) => setMaintenanceType(e.target.value as any)}
              className="w-full bg-[#020617] border border-[#334155] rounded-lg p-2.5 font-mono text-xs text-on-surface focus:outline-none focus:border-amber-500 transition-colors"
            >
              <option value="vidange">Vidange périodique (moteur / filtres)</option>
              <option value="revision">Révision générale / Contrôle technique</option>
              <option value="pneus">Changement / Permutation de pneumatiques</option>
              <option value="autre">Autre révision préventive ou atelier</option>
            </select>
          </div>

          {/* Garage partenaire (optionnel) */}
          {garages.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="maintenance-garage-select"
                className="block font-mono text-xs text-on-surface-variant font-medium uppercase tracking-wider"
              >
                Garage / Atelier assigné
              </label>
              <select
                id="maintenance-garage-select"
                value={selectedGarageId}
                onChange={(e) => setSelectedGarageId(e.target.value)}
                className="w-full bg-[#020617] border border-[#334155] rounded-lg p-2.5 font-mono text-xs text-on-surface focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="">Sélectionner un atelier (optionnel)</option>
                {garages.map((gar) => (
                  <option key={gar.id} value={gar.id}>
                    {gar.name} {gar.location ? `— ${gar.location}` : ''}
                  </option>
                ))}
              </select>
            </div>
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
