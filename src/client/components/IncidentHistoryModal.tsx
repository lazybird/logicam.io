import React from 'react';
import { X, Clock, AlertTriangle, Wrench, ShieldCheck, History } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import type { IncidentDTO } from '../../shared/types';

interface IncidentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  incidents: IncidentDTO[];
}

export const IncidentHistoryModal: React.FC<IncidentHistoryModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  incidents,
}) => {
  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-surface border border-[#334155] rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* En-tête */}
        <div className="p-4 bg-surface-container border-b border-[#334155] flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-[#334155] flex items-center justify-center text-on-surface">
              <History className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold text-on-surface">
                {title}
              </h2>
              {subtitle && (
                <p className="font-mono text-xs text-[#ffb77d]">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-variant text-on-surface-variant hover:text-on-surface transition-colors"
            aria-label="Fermer l'historique"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps - Liste des interventions */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2.5 font-mono text-xs">
          {incidents.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant flex flex-col items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-emerald-400/60" />
              <p>Aucun événement ou incident enregistré dans l'historique.</p>
            </div>
          ) : (
            incidents.map((inc) => (
              <div
                key={inc.id}
                className="p-3 rounded-lg bg-[#020617]/80 border border-[#334155]/70 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        inc.type === 'breakdown'
                          ? 'bg-red-950 text-red-300 border border-red-500/50'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/50'
                      }`}
                    >
                      {inc.type === 'breakdown' ? 'Panne' : 'Maintenance'}
                    </span>
                    {inc.category && (
                      <span className="font-semibold text-on-surface text-xs">
                        {inc.category.name}
                      </span>
                    )}
                    {inc.garage && (
                      <span className="text-on-surface-variant text-[11px]">
                        @ {inc.garage.name}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(inc.createdAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {inc.notes && (
                  <p className="text-on-surface font-sans text-xs bg-surface-container/60 p-2 rounded border border-[#334155]/40 leading-relaxed">
                    "{inc.notes}"
                  </p>
                )}

                {inc.reportedByName && (
                  <div className="text-[10px] text-on-surface-variant/80 flex items-center justify-end">
                    <span>Enregistré par {inc.reportedByName}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pied de page */}
        <div className="p-3 bg-surface-container border-t border-[#334155] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-[#334155] hover:bg-surface-variant text-on-surface font-mono text-xs transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
