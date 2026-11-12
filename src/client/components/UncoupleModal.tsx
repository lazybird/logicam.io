import React, { useState } from 'react';
import { X, Unlink, AlertTriangle, Truck, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface UncoupleModalProps {
  isOpen: boolean;
  onClose: () => void;
  couplingId: string;
  couplingLabel: string;
  onSuccess: () => void;
}

export const UncoupleModal: React.FC<UncoupleModalProps> = ({
  isOpen,
  onClose,
  couplingId,
  couplingLabel,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/fleet/couplings/${couplingId}/uncouple`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors du désattelage');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-surface border border-[#334155] rounded-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* En-tête */}
        <div className="p-4 bg-surface-container border-b border-[#334155] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Unlink className="w-5 h-5 text-red-400" />
            <h2 className="font-mono text-base font-bold text-on-surface">
              Désatteler
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-variant transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-500/40 rounded text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Icône d'avertissement */}
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-on-surface">
                Confirmer le désattelage
              </p>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Vous êtes sur le point de désatteler l'ensemble suivant :
              </p>
            </div>
          </div>

          {/* Récapitulatif de l'attelage */}
          <div className="bg-surface-container border border-[#334155] rounded-lg p-3.5 flex items-center gap-3">
            <Truck className="w-5 h-5 text-primary shrink-0" />
            <span className="font-mono text-xs text-on-surface font-medium truncate">
              {couplingLabel}
            </span>
          </div>

          <p className="text-xs text-on-surface-variant/70 text-center">
            Cette action est réversible : vous pourrez ré-atteler ces véhicules à tout moment.
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-[#334155]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-[#334155] rounded font-mono text-xs text-on-surface-variant hover:bg-surface-variant transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-semibold rounded flex items-center gap-2 transition-all disabled:opacity-50 shadow-[0_0_12px_rgba(220,38,38,0.25)]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Désattelage...</span>
                </>
              ) : (
                <>
                  <Unlink className="w-4 h-4" />
                  <span>Confirmer le Désattelage</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
