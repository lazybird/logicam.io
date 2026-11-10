import React, { useState } from 'react';
import { X, Link2, Truck, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import type { TractorDTO, TrailerDTO } from '../../shared/types';

interface CouplingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tractors: TractorDTO[];
  trailers: TrailerDTO[];
  onSuccess: () => void;
  initialTractorId?: string;
  initialTrailerId?: string;
}

export const CouplingModal: React.FC<CouplingModalProps> = ({
  isOpen,
  onClose,
  tractors,
  trailers,
  onSuccess,
  initialTractorId,
  initialTrailerId,
}) => {
  const [selectedTractorId, setSelectedTractorId] = useState(initialTractorId || '');
  const [selectedTrailerId, setSelectedTrailerId] = useState(initialTrailerId || '');
  const [driverName, setDriverName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTractorId || !selectedTrailerId) {
      setError('Veuillez sélectionner à la fois un tracteur et une remorque');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post('/api/fleet/couple', {
        tractorId: selectedTractorId,
        trailerId: selectedTrailerId,
        driverName: driverName.trim() || undefined,
        orderNumber: orderNumber.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création de l’attelage');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTractor = tractors.find((t) => t.id === selectedTractorId);
  const selectedTrailer = trailers.find((tr) => tr.id === selectedTrailerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-[#334155] rounded-xl overflow-hidden shadow-2xl flex flex-col">
        {/* En-tête */}
        <div className="p-4 bg-surface-container border-b border-[#334155] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            <h2 className="font-mono text-base font-bold text-on-surface">
              Nouvel Attelage / Changement
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-variant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-500/40 rounded text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Sélection du Tracteur */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs uppercase tracking-wider text-on-surface flex justify-between">
              <span>Tracteur</span>
              {selectedTractor?.isCoupled && (
                <span className="text-amber-400 font-sans text-[11px] normal-case">
                  ⚠️ Déjà attelé (sera réaffecté)
                </span>
              )}
            </label>
            <select
              value={selectedTractorId}
              onChange={(e) => setSelectedTractorId(e.target.value)}
              required
              className="bg-[#020617] border border-[#334155] rounded text-on-surface font-mono text-xs py-2.5 px-3 focus:outline-none focus:border-[#ff8c00]"
            >
              <option value="">Sélectionner un tracteur...</option>
              {tractors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.plateNumber} {t.brandModel ? `(${t.brandModel})` : ''} —{' '}
                  {t.isCoupled ? 'Actuellement attelé' : 'DISPONIBLE'}
                </option>
              ))}
            </select>
          </div>

          {/* Sélection de la Remorque */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs uppercase tracking-wider text-on-surface flex justify-between">
              <span>Remorque</span>
              {selectedTrailer?.isCoupled && (
                <span className="text-amber-400 font-sans text-[11px] normal-case">
                  ⚠️ Déjà attelée (sera réaffectée)
                </span>
              )}
            </label>
            <select
              value={selectedTrailerId}
              onChange={(e) => setSelectedTrailerId(e.target.value)}
              required
              className="bg-[#020617] border border-[#334155] rounded text-on-surface font-mono text-xs py-2.5 px-3 focus:outline-none focus:border-[#ff8c00]"
            >
              <option value="">Sélectionner une remorque...</option>
              {trailers.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.plateNumber} [{tr.trailerType}] —{' '}
                  {tr.isCoupled ? 'Actuellement attelée' : 'DISPONIBLE'}
                </option>
              ))}
            </select>
          </div>

          {/* Nom du Chauffeur */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs uppercase tracking-wider text-on-surface">
              Nom du Chauffeur (optionnel)
            </label>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="Ex: Amadou Ba"
              className="bg-[#020617] border border-[#334155] rounded text-on-surface font-sans text-xs py-2.5 px-3 focus:outline-none focus:border-[#ff8c00]"
            />
          </div>

          {/* N° d'ordre personnalisé */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs uppercase tracking-wider text-on-surface">
              N° d'Ordre (laisser vide pour auto-génération)
            </label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Ex: #ORD-9930"
              className="bg-[#020617] border border-[#334155] rounded text-on-surface font-mono text-xs py-2.5 px-3 focus:outline-none focus:border-[#ff8c00]"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[#334155]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-[#334155] rounded font-mono text-xs text-on-surface-variant hover:bg-surface-variant transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedTractorId || !selectedTrailerId}
              className="px-5 py-2 bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-mono text-xs font-semibold rounded flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Truck className="w-4 h-4" />
              <span>{isSubmitting ? 'Attelage en cours...' : 'Valider l’Attelage'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
