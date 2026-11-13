import React, { useState } from 'react';
import { X, AlertTriangle, Truck, Loader2, Unlink } from 'lucide-react';
import { api } from '../lib/api';
import { useEscapeKey } from '../hooks/useEscapeKey';
import type { BreakdownCategoryDTO, VehicleStatus } from '../../shared/types';

export type BreakdownTargetScope = 'tractor' | 'trailer' | 'both';

interface BreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  coupling: {
    id: string;
    orderNumber: string;
    tractorId: string;
    tractorPlate: string;
    tractorStatus: VehicleStatus;
    trailerId: string;
    trailerPlate: string;
    trailerStatus: VehicleStatus;
  } | null;
  categories: BreakdownCategoryDTO[];
  onSuccess: () => void;
}

export const BreakdownModal: React.FC<BreakdownModalProps> = ({
  isOpen,
  onClose,
  coupling,
  categories,
  onSuccess,
}) => {
  const [targetScope, setTargetScope] = useState<BreakdownTargetScope>('tractor');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [uncoupleImmediately, setUncoupleImmediately] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(isOpen, onClose);

  if (!isOpen || !coupling) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Mettre à jour le statut du tracteur si concerné
      if (targetScope === 'tractor' || targetScope === 'both') {
        await api.patch(`/api/fleet/tractors/${coupling.tractorId}`, {
          status: 'breakdown',
        });
      }

      // 2. Mettre à jour le statut de la remorque si concernée
      if (targetScope === 'trailer' || targetScope === 'both') {
        await api.patch(`/api/fleet/trailers/${coupling.trailerId}`, {
          status: 'breakdown',
        });
      }

      // 3. Si désattelage immédiat demandé (ex: remorque en panne laissée sur place)
      if (uncoupleImmediately) {
        await api.post(`/api/fleet/couplings/${coupling.id}/uncouple`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la déclaration de la panne');
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
            <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-on-surface">
                Déclarer une panne
              </h2>
              <p className="font-mono text-xs text-[#ffb77d]">
                Attelage {coupling.orderNumber}
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
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Choix de l'élément en panne */}
          <div className="flex flex-col gap-2">
            <label className="block font-mono text-xs text-on-surface-variant font-medium uppercase tracking-wider">
              Quel élément est en panne ? *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetScope('tractor')}
                className={`p-3 rounded-lg border font-mono text-xs flex flex-col items-center gap-1.5 text-center transition-all ${
                  targetScope === 'tractor'
                    ? 'bg-red-500/20 border-red-500 text-red-300 ring-1 ring-red-500 font-semibold'
                    : 'bg-surface-container border-[#334155] text-on-surface-variant hover:border-[#ff8c00]/50'
                }`}
              >
                <Truck className="w-4 h-4 text-primary" />
                <span className="text-[11px]">Tracteur seul</span>
                <span className="text-[10px] text-on-surface-variant truncate w-full">
                  {coupling.tractorPlate}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTargetScope('trailer')}
                className={`p-3 rounded-lg border font-mono text-xs flex flex-col items-center gap-1.5 text-center transition-all ${
                  targetScope === 'trailer'
                    ? 'bg-red-500/20 border-red-500 text-red-300 ring-1 ring-red-500 font-semibold'
                    : 'bg-surface-container border-[#334155] text-on-surface-variant hover:border-[#4edea3]/50'
                }`}
              >
                <Truck className="w-4 h-4 text-[#4edea3]" />
                <span className="text-[11px]">Remorque seule</span>
                <span className="text-[10px] text-on-surface-variant truncate w-full">
                  {coupling.trailerPlate}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTargetScope('both')}
                className={`p-3 rounded-lg border font-mono text-xs flex flex-col items-center gap-1.5 text-center transition-all ${
                  targetScope === 'both'
                    ? 'bg-red-500/20 border-red-500 text-red-300 ring-1 ring-red-500 font-semibold'
                    : 'bg-surface-container border-[#334155] text-on-surface-variant hover:border-red-400/50'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-[11px]">Les deux</span>
                <span className="text-[10px] text-on-surface-variant truncate w-full">
                  Ensemble complet
                </span>
              </button>
            </div>
          </div>

          {/* Catégorie de panne */}
          {categories.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="breakdown-category-select"
                className="block font-mono text-xs text-on-surface-variant font-medium uppercase tracking-wider"
              >
                Type d'anomalie / Catégorie
              </label>
              <select
                id="breakdown-category-select"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full bg-[#020617] border border-[#334155] rounded-lg p-2.5 font-mono text-xs text-on-surface focus:outline-none focus:border-red-500 transition-colors"
              >
                <option value="">Sélectionner une catégorie (optionnel)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.severity.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes / Description */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="breakdown-notes"
              className="block font-mono text-xs text-on-surface-variant font-medium uppercase tracking-wider"
            >
              Précisions sur la panne (optionnel)
            </label>
            <textarea
              id="breakdown-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Crevaison essieu droit sur RN1, voyant moteur allumé..."
              className="w-full bg-[#020617] border border-[#334155] rounded-lg p-2.5 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-red-500 transition-colors resize-none"
            />
          </div>

          {/* Option Désatteler immédiatement */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-[#334155] bg-surface-container cursor-pointer hover:border-[#ff8c00]/50 transition-colors">
            <input
              type="checkbox"
              checked={uncoupleImmediately}
              onChange={(e) => setUncoupleImmediately(e.target.checked)}
              className="mt-0.5 rounded border-[#334155] text-red-500 focus:ring-0 focus:outline-none bg-[#020617] w-4 h-4 cursor-pointer"
            />
            <div className="flex-1">
              <span className="font-mono text-xs font-semibold text-on-surface flex items-center gap-1.5">
                <Unlink className="w-3.5 h-3.5 text-red-400" />
                Désatteler immédiatement l'ensemble
              </span>
              <p className="font-sans text-[11px] text-on-surface-variant mt-0.5">
                Libère le véhicule sain pour qu'il puisse être réattelé de suite.
              </p>
            </div>
          </label>

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
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-medium transition-colors flex items-center gap-2 shadow-lg shadow-red-950/40 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirmer la panne</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
