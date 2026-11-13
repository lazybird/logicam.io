import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, Plus } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';

export interface SearchableSelectOption {
  id: string;
  label: string;
  badge?: string;
  badgeColor?: 'emerald' | 'amber' | 'blue' | 'gray' | 'red';
  subLabel?: string;
  searchKeywords?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  label: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  // Support multi-sélection
  multiple?: boolean;
  values?: string[];
  onMultiChange?: (values: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  warningNotice?: React.ReactNode;
  required?: boolean;
  autoFocus?: boolean;
  // Support création rapide à la volée ("Ajouter nouveau sujet / panne")
  allowCreate?: boolean;
  createLabel?: string;
  onCreateNew?: (name: string) => Promise<string | void> | void;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  options,
  value,
  onChange,
  multiple = false,
  values = [],
  onMultiChange,
  placeholder = 'Sélectionner...',
  emptyMessage = 'Aucun élément trouvé',
  warningNotice,
  required = false,
  allowCreate = false,
  createLabel = 'Créer nouveau sujet...',
  onCreateNew,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);
  const selectedOptions = options.filter((opt) => values.includes(opt.id));

  useEscapeKey(isOpen, () => setIsOpen(false));

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Click outside to close (desktop dropdown)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredOptions = options.filter((opt) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const l = opt.label.toLowerCase();
    const sub = (opt.subLabel || '').toLowerCase();
    const b = (opt.badge || '').toLowerCase();
    const k = (opt.searchKeywords || '').toLowerCase();
    return l.includes(q) || sub.includes(q) || b.includes(q) || k.includes(q);
  });

  const getBadgeClass = (color?: SearchableSelectOption['badgeColor']) => {
    switch (color) {
      case 'red':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'emerald':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'amber':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'blue':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'gray':
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const handleToggleOption = (optId: string) => {
    if (multiple) {
      const nextValues = values.includes(optId)
        ? values.filter((id) => id !== optId)
        : [...values, optId];
      if (onMultiChange) {
        onMultiChange(nextValues);
      }
    } else {
      onChange(optId);
      setIsOpen(false);
    }
  };

  const handleCreate = async () => {
    if (!search.trim() || !onCreateNew) return;
    setIsCreating(true);
    try {
      const newId = await onCreateNew(search.trim());
      setSearch('');
      if (newId) {
        if (multiple) {
          if (onMultiChange) onMultiChange([...values, newId]);
        } else {
          onChange(newId);
          setIsOpen(false);
        }
      }
    } finally {
      setIsCreating(false);
    }
  };

  const exactMatchExists = options.some(
    (opt) => opt.label.trim().toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label className="font-mono text-xs uppercase tracking-wider text-on-surface flex justify-between items-center">
        <span>
          {label} {required && <span className="text-primary">*</span>}
          {multiple && values.length > 0 && (
            <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded-full bg-primary/20 text-primary border border-primary/30">
              {values.length} sélectionné{values.length > 1 ? 's' : ''}
            </span>
          )}
        </span>
        {warningNotice}
      </label>

      {/* Bouton de déclenchement du sélecteur */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[44px] bg-[#020617] border rounded text-left font-mono text-xs py-2 px-3 flex items-center justify-between gap-2 transition-all ${
          isOpen
            ? 'border-[#ff8c00] ring-1 ring-[#ff8c00]'
            : 'border-[#334155] hover:border-[#475569]'
        }`}
      >
        <div className="flex-1 min-w-0">
          {multiple ? (
            values.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 py-0.5">
                {selectedOptions.map((opt) => (
                  <span
                    key={opt.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-high border border-[#334155] text-on-surface text-[11px]"
                  >
                    <span className="truncate max-w-[150px]">{opt.label}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleOption(opt.id);
                      }}
                      className="text-on-surface-variant hover:text-red-400 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-on-surface-variant/60">{placeholder}</span>
            )
          ) : selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-on-surface font-semibold truncate">
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0 ${getBadgeClass(
                    selectedOption.badgeColor
                  )}`}
                >
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-on-surface-variant/60">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-on-surface-variant transition-transform shrink-0 ${
            isOpen ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>

      {/* Menu Options: Popover Responsive */}
      {isOpen && (
        <>
          {/* Backdrop pour mobile */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 md:hidden animate-in fade-in duration-150"
            onClick={() => setIsOpen(false)}
          />

          <div
            className={`
              fixed inset-x-0 bottom-0 z-50 md:static md:z-30
              bg-surface border border-[#334155] rounded-t-2xl md:rounded-lg shadow-2xl
              flex flex-col max-h-[80vh] md:max-h-[320px] md:mt-1 overflow-hidden
              animate-in slide-in-from-bottom md:slide-in-from-top-2 duration-200
            `}
          >
            {/* Header mobile avec titre et bouton fermer */}
            <div className="flex items-center justify-between p-3 border-b border-[#334155] md:hidden">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-on-surface">
                {label}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Champ de recherche */}
            <div className="p-2 border-b border-[#334155] bg-surface-container/50">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 absolute left-2.5 text-on-surface-variant" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Rechercher ${label.toLowerCase()}...`}
                  className="w-full bg-[#020617] border border-[#334155] rounded font-mono text-xs pl-8 pr-8 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-[#ff8c00]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 p-1 text-on-surface-variant hover:text-on-surface"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Création à la volée si autorisé et texte non vide */}
            {allowCreate && search.trim() && !exactMatchExists && (
              <div className="p-2 bg-primary/10 border-b border-[#334155]">
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={handleCreate}
                  className="w-full py-1.5 px-3 rounded bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 font-mono text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {createLabel} : <strong className="underline">"{search.trim()}"</strong>
                  </span>
                </button>
              </div>
            )}

            {/* Liste scrollable des options */}
            <div className="overflow-y-auto flex-1 p-1 space-y-0.5 divide-y divide-[#334155]/20 max-h-[60vh] md:max-h-[240px]">
              {filteredOptions.length === 0 ? (
                <div className="py-6 px-3 text-center text-xs font-mono text-on-surface-variant">
                  {emptyMessage}
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = multiple
                    ? values.includes(opt.id)
                    : opt.id === value;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => handleToggleOption(opt.id)}
                      className={`w-full text-left p-2.5 rounded font-mono text-xs flex items-center justify-between gap-2 transition-colors ${
                        isSelected
                          ? 'bg-[#ff8c00]/15 text-[#ffb77d] font-semibold border-l-2 border-[#ff8c00]'
                          : 'hover:bg-surface-variant text-on-surface'
                      } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className="truncate">{opt.label}</span>
                          {opt.badge && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded border font-mono shrink-0 ${getBadgeClass(
                                opt.badgeColor
                              )}`}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.subLabel && (
                          <span className="text-[10px] text-on-surface-variant truncate font-sans">
                            {opt.subLabel}
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Pied pour modale multi-sélection */}
            {multiple && (
              <div className="p-2 border-t border-[#334155] bg-surface-container flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-mono text-[11px]">
                  {values.length} élément{values.length > 1 ? 's' : ''} coché{values.length > 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1 rounded bg-[#334155] hover:bg-[#475569] text-on-surface font-mono text-xs"
                >
                  Valider la sélection
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
