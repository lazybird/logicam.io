import React, { useState } from 'react';
import {
  Truck,
  Building2,
  Users,
  LogOut,
  ChevronDown,
  PlusCircle,
  Menu,
  X,
  Radio,
  Layers,
} from 'lucide-react';
import { useAuth, useTeamPolicy } from '../context/AuthContext';

export type NavTab = 'fleet' | 'super-admin-orgs' | 'admin';

interface LayoutProps {
  currentTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  onOpenCouplingModal: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentTab,
  onNavigate,
  onOpenCouplingModal,
  children,
}) => {
  const { user, currentOrg, organizations, switchOrganization, logout } = useAuth();
  const { can } = useTeamPolicy();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isOrgAdmin = user?.role === 'ORG_ADMIN';

  const handleOrgChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const orgId = e.target.value;
    if (!orgId || orgId === currentOrg?.id) return;
    setSwitching(true);
    try {
      await switchOrganization(orgId);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1326] text-on-surface flex flex-col font-sans">
      {/* TopNavBar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-6 h-16 bg-surface border-b border-[#334155]">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            type="button"
            className="lg:hidden text-on-surface-variant hover:text-primary p-1 shrink-0"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Fermer le menu de navigation' : 'Ouvrir le menu de navigation'}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => onNavigate('fleet')}>
            <span className="w-3 h-3 rounded-sm bg-[#ff8c00]"></span>
            <span className="font-mono text-xl font-bold tracking-tight text-[#ffb77d]">LogiCam.io</span>
          </div>

          {/* Badge de Rôle */}
          {isSuperAdmin ? (
            <span className="hidden sm:inline-flex px-2 py-0.5 bg-[#6366F1]/20 text-[#6366F1] border border-[#6366F1] font-mono text-[11px] rounded uppercase tracking-wider font-semibold shrink-0">
              SUPER ADMIN
            </span>
          ) : isOrgAdmin ? (
            <span className="hidden sm:inline-flex px-2 py-0.5 bg-[#ff8c00]/20 text-[#ffb77d] border border-[#ff8c00]/40 font-mono text-[11px] rounded uppercase tracking-wider font-semibold shrink-0">
              ADMIN ORG
            </span>
          ) : (
            <span className="hidden sm:inline-flex px-2 py-0.5 bg-[#4edea3]/20 text-[#4edea3] border border-[#4edea3]/40 font-mono text-[11px] rounded uppercase tracking-wider font-semibold shrink-0">
              {user?.team?.name || 'AGENT TERRAIN'}
            </span>
          )}

          {/* Sélecteur de Transporteur pour le Super Admin — déplacé à côté du logo */}
          {isSuperAdmin && organizations.length > 0 && (
            <div className="relative flex items-center ml-1 sm:ml-2 border-l border-[#334155] pl-2 sm:pl-3">
              <span className="hidden lg:inline text-[10px] font-mono text-on-surface-variant mr-1.5 shrink-0">
                Société :
              </span>
              <div className="relative">
                <select
                  value={currentOrg?.id || ''}
                  onChange={handleOrgChange}
                  disabled={switching}
                  className="bg-surface-container border border-[#334155] rounded text-on-surface text-xs font-mono py-1.5 pl-2 pr-7 max-w-[140px] md:max-w-[200px] focus:outline-none focus:border-[#ff8c00] transition-colors appearance-none cursor-pointer truncate"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id} className="bg-surface-container text-on-surface">
                      {org.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" />
              </div>
            </div>
          )}

          {/* Transporteur pour utilisateur normal */}
          {!isSuperAdmin && currentOrg && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded bg-surface-container border border-[#334155] shrink-0">
              <span className="font-mono text-xs text-primary font-medium truncate max-w-[120px]">{currentOrg.name}</span>
            </div>
          )}
        </div>

        {/* Contrôles droits */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Indicateur En Ligne */}
          <div className="hidden sm:flex items-center gap-1.5 border border-[#334155] rounded-full px-2.5 py-1 bg-surface-container-low">
            <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
            <span className="font-mono text-[10px] text-[#4edea3]">En ligne</span>
          </div>

          {/* Profil / Nom de l'utilisateur */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-surface-container-highest border border-[#334155] flex items-center justify-center font-mono text-xs font-bold text-primary shrink-0">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-medium text-on-surface truncate max-w-[100px]">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="text-[10px] text-on-surface-variant font-mono">
                {user?.phone}
              </span>
            </div>
          </div>

          {/* Déconnexion */}
          <button
            type="button"
            onClick={logout}
            className="p-1.5 rounded hover:bg-surface-variant text-on-surface-variant hover:text-red-400 transition-colors shrink-0"
            title="Se déconnecter"
            aria-label="Se déconnecter de votre compte"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* SideNavBar Desktop */}
      <aside className="hidden lg:flex flex-col h-screen fixed left-0 top-0 border-r border-[#334155] bg-surface-container w-64 pt-16 z-40">
        {/* Info Société */}
        <div className="p-4 border-b border-[#334155] flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[#ff8c00]/20 border border-[#ff8c00]/40 flex items-center justify-center text-[#ffb77d] font-bold font-mono text-lg">
            {currentOrg?.name?.[0] || 'L'}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="font-mono text-sm font-semibold text-primary truncate">
              {currentOrg?.name || 'LogiCam Flotte'}
            </div>
            <div className="font-mono text-[11px] text-on-surface-variant truncate">
              {user?.team?.name || (isSuperAdmin ? 'Gestion Centrale' : 'Opérations')}
            </div>
          </div>
        </div>

        {/* Bouton Nouvel Attelage */}
        {can('couplings:change') && (
          <div className="p-4">
            <button
              type="button"
              onClick={onOpenCouplingModal}
              className="w-full bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-mono text-xs font-semibold py-2.5 px-4 rounded border border-[#ff8c00] transition-colors flex justify-center items-center gap-2 shadow-[0_0_12px_rgba(255,140,0,0.25)]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>NOUVEL ATTELAGE</span>
            </button>
          </div>
        )}

        {/* Liens de Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 flex flex-col gap-1 px-2">
          {/* État de la flotte */}
          <button
            type="button"
            onClick={() => onNavigate('fleet')}
            className={`w-full text-left font-mono text-xs px-3 py-3 rounded flex items-center gap-3 transition-colors ${
              currentTab === 'fleet'
                ? 'bg-[#ff8c00] text-black font-semibold border-l-4 border-[#ffb77d]'
                : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
            }`}
          >
            <Truck className="w-4 h-4 shrink-0" />
            <span>État de la Flotte</span>
          </button>

          {/* Organisations (Super Admin) */}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('super-admin-orgs')}
              className={`w-full text-left font-mono text-xs px-3 py-3 rounded flex items-center gap-3 transition-colors ${
                currentTab === 'super-admin-orgs'
                  ? 'bg-[#6366F1] text-white font-semibold border-l-4 border-[#c0c1ff]'
                  : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Organisations (Super Admin)</span>
            </button>
          )}

          {/* Administration d'organisation */}
          {(isSuperAdmin || isOrgAdmin || can('members:read')) && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className={`w-full text-left font-mono text-xs px-3 py-3 rounded flex items-center gap-3 transition-colors ${
                currentTab === 'admin'
                  ? 'bg-surface-container-highest text-primary font-semibold border-l-4 border-[#ff8c00]'
                  : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Administration</span>
            </button>
          )}
        </nav>

        {/* Pied de sidebar */}
        <div className="border-t border-[#334155] p-3 text-center">
          <span className="font-mono text-[10px] text-on-surface-variant/60">
            LogiCam Industrial OS v0.1.0
          </span>
        </div>
      </aside>

      {/* Menu mobile déroulant */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 pt-16" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="w-64 bg-surface-container h-full p-4 flex flex-col gap-2 border-r border-[#334155]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-mono text-xs text-primary font-semibold mb-2">
              {currentOrg?.name}
            </div>

            {can('couplings:change') && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenCouplingModal();
                }}
                className="w-full bg-[#ff8c00] text-black font-mono text-xs py-2 px-3 rounded flex items-center justify-center gap-2 mb-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>NOUVEL ATTELAGE</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onNavigate('fleet');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left font-mono text-xs p-2.5 rounded flex items-center gap-2 ${
                currentTab === 'fleet' ? 'bg-[#ff8c00] text-black font-semibold' : 'text-on-surface-variant'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>État de la Flotte</span>
            </button>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  onNavigate('super-admin-orgs');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left font-mono text-xs p-2.5 rounded flex items-center gap-2 ${
                  currentTab === 'super-admin-orgs'
                    ? 'bg-[#6366F1] text-white font-semibold'
                    : 'text-on-surface-variant'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Organisations</span>
              </button>
            )}

            {(isSuperAdmin || isOrgAdmin || can('members:read')) && (
              <button
                type="button"
                onClick={() => {
                  onNavigate('admin');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left font-mono text-xs p-2.5 rounded flex items-center gap-2 ${
                  currentTab === 'admin'
                    ? 'bg-surface-container-highest text-primary font-semibold'
                    : 'text-on-surface-variant'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Administration</span>
              </button>
            )}

            {/* Séparateur */}
            <div className="mt-auto pt-4 border-t border-[#334155]">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="w-full text-left font-mono text-xs p-2.5 rounded flex items-center gap-2 text-on-surface-variant hover:text-red-400 hover:bg-surface-variant transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Se déconnecter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenu Principal */}
      <main className="flex-1 lg:ml-64 pt-16 flex flex-col min-h-screen bg-[#0b1326]">{children}</main>
    </div>
  );
};
