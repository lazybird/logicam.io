import React, { useState, useEffect } from 'react';
import {
  Building2,
  Truck,
  Users,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  X,
  TrendingUp,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { OrganizationDTO } from '../../shared/types';

interface OrganizationItem extends OrganizationDTO {
  stats: {
    tractorsCount: number;
    trailersCount: number;
    activeCouplingsCount: number;
    membersCount: number;
  };
  admin?: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
  } | null;
}

interface SuperAdminApiResponse {
  organizations: OrganizationItem[];
  kpis: {
    activeOrgsCount: number;
    totalFleetCount: number;
    totalUsersCount: number;
  };
}

interface SuperAdminOrgsProps {
  onManageOrg: (orgId: string) => void;
}

export const SuperAdminOrgs: React.FC<SuperAdminOrgsProps> = ({ onManageOrg }) => {
  const { switchOrganization } = useAuth();
  const [data, setData] = useState<SuperAdminApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Formulaire nouvelle organisation
  const [newOrgName, setNewOrgName] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPin, setAdminPin] = useState('1234');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get<SuperAdminApiResponse>('/api/organizations');
      setData(res);
    } catch (err: any) {
      console.error('Erreur chargement organisations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (org: OrganizationItem) => {
    const nextStatus = org.subscriptionStatus === 'active' ? 'suspended' : 'active';
    try {
      await api.patch(`/api/organizations/${org.id}`, { subscriptionStatus: nextStatus });
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Erreur lors de la modification du statut');
    }
  };

  const handleManage = async (orgId: string) => {
    await switchOrganization(orgId);
    onManageOrg(orgId);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      await api.post('/api/organizations', {
        name: newOrgName.trim(),
        admin: adminPhone.trim()
          ? {
              firstName: adminFirstName.trim() || 'Admin',
              lastName: adminLastName.trim() || newOrgName.trim(),
              phone: adminPhone.trim(),
              email: adminEmail.trim() || undefined,
              pin: adminPin.trim() || '1234',
            }
          : undefined,
      });

      setNewOrgName('');
      setAdminFirstName('');
      setAdminLastName('');
      setAdminPhone('');
      setAdminEmail('');
      setAdminPin('1234');
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err?.message || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOrgs = (data?.organizations || []).filter((org) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      org.name.toLowerCase().includes(term) ||
      org.slug.toLowerCase().includes(term) ||
      org.admin?.email?.toLowerCase().includes(term) ||
      org.admin?.name.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#6366F1]/20 text-[#6366F1] border border-[#6366F1] font-mono text-[10px] rounded uppercase font-semibold">
              SUPER ADMIN
            </span>
            <h1 className="font-mono text-2xl font-bold text-on-surface">Gestion des Transporteurs</h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Console d'administration globale et gestion multi-tenant
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-mono text-xs font-semibold rounded flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(255,140,0,0.3)]"
        >
          <Plus className="w-4 h-4" />
          <span>NOUVELLE ORGANISATION</span>
        </button>
      </div>

      {/* 3 Cartes KPIs Globaux */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1 : Organisations Actives */}
        <div className="bg-surface-container border border-[#334155] p-5 rounded relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-bl-full transition-transform group-hover:scale-110"></div>
          <Building2 className="w-6 h-6 text-primary mb-3" />
          <h3 className="font-mono text-xs text-on-surface-variant uppercase tracking-wider mb-1">
            ORGANISATIONS ACTIVES
          </h3>
          <div className="font-mono text-3xl font-bold text-on-surface">
            {data?.kpis.activeOrgsCount ?? 0}
          </div>
          <div className="font-mono text-[11px] text-[#4edea3] mt-2 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Multi-tenant opérationnel</span>
          </div>
        </div>

        {/* KPI 2 : Flotte Totale */}
        <div className="bg-surface-container border border-[#334155] p-5 rounded relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-[#6366F1]/5 rounded-bl-full transition-transform group-hover:scale-110"></div>
          <Truck className="w-6 h-6 text-[#6366F1] mb-3" />
          <h3 className="font-mono text-xs text-on-surface-variant uppercase tracking-wider mb-1">
            FLOTTE TOTALE
          </h3>
          <div className="font-mono text-3xl font-bold text-on-surface">
            {data?.kpis.totalFleetCount ?? 0}
          </div>
          <div className="font-mono text-[11px] text-[#4edea3] mt-2 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Tracteurs et remorques gérés</span>
          </div>
        </div>

        {/* KPI 3 : Utilisateurs */}
        <div className="bg-surface-container border border-[#334155] p-5 rounded relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-[#4edea3]/5 rounded-bl-full transition-transform group-hover:scale-110"></div>
          <Users className="w-6 h-6 text-[#4edea3] mb-3" />
          <h3 className="font-mono text-xs text-on-surface-variant uppercase tracking-wider mb-1">
            UTILISATEURS ACTIFS
          </h3>
          <div className="font-mono text-3xl font-bold text-on-surface">
            {data?.kpis.totalUsersCount ?? 0}
          </div>
          <div className="font-mono text-[11px] text-[#4edea3] mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Comptes PIN & Équipes</span>
          </div>
        </div>
      </div>

      {/* Table des Organisations */}
      <div className="bg-surface-container border border-[#334155] rounded overflow-hidden flex flex-col">
        {/* Barre d'outils */}
        <div className="bg-surface p-3 md:p-4 border-b border-[#334155] flex justify-between items-center">
          <h2 className="font-mono text-sm font-bold text-on-surface">
            Liste des Transporteurs ({filteredOrgs.length})
          </h2>
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full bg-[#020617] border border-[#334155] rounded pl-9 pr-3 py-1 font-mono text-xs text-on-surface focus:outline-none focus:border-[#ff8c00]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-surface-container-low border-b border-[#334155]">
                <th className="p-3.5 uppercase text-on-surface-variant font-medium">SOCIÉTÉ</th>
                <th className="p-3.5 uppercase text-on-surface-variant font-medium">ADMINISTRATEUR</th>
                <th className="p-3.5 uppercase text-on-surface-variant font-medium">VÉHICULES</th>
                <th className="p-3.5 uppercase text-on-surface-variant font-medium">STATUT</th>
                <th className="p-3.5 uppercase text-on-surface-variant font-medium text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/40">
              {filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-on-surface-variant">
                    Aucune organisation trouvée.
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org, index) => {
                  const initial = org.name[0]?.toUpperCase() || 'O';
                  const isWal = org.name.toLowerCase().includes('west africa');
                  const avatarColor = isWal
                    ? 'text-primary border-primary/40 bg-primary/10'
                    : 'text-[#6366F1] border-[#6366F1]/40 bg-[#6366F1]/10';

                  const totalVehicles = org.stats.tractorsCount + org.stats.trailersCount;

                  return (
                    <tr
                      key={org.id}
                      className="hover:bg-surface-variant/30 transition-colors bg-surface"
                    >
                      {/* Société */}
                      <td className="p-3.5 flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded border flex items-center justify-center font-bold ${avatarColor}`}
                        >
                          {initial}
                        </div>
                        <div>
                          <div className="font-semibold text-on-surface">{org.name}</div>
                          <div className="text-[10px] text-on-surface-variant">{org.slug}</div>
                        </div>
                      </td>

                      {/* Admin */}
                      <td className="p-3.5 text-on-surface-variant">
                        {org.admin ? (
                          <div>
                            <div className="text-on-surface">{org.admin.name}</div>
                            <div className="text-[11px] text-on-surface-variant/70">
                              {org.admin.email || org.admin.phone}
                            </div>
                          </div>
                        ) : (
                          <span className="text-on-surface-variant/50 italic">Aucun admin</span>
                        )}
                      </td>

                      {/* Véhicules */}
                      <td className="p-3.5">
                        <span className="font-bold text-on-surface">{totalVehicles}</span>
                        <span className="text-[10px] text-on-surface-variant block">
                          {org.stats.activeCouplingsCount} attelages actifs
                        </span>
                      </td>

                      {/* Statut Abonnement */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(org)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] border transition-colors ${
                            org.subscriptionStatus === 'active'
                              ? 'bg-[#4edea3]/10 text-[#4edea3] border-[#4edea3]/30 hover:bg-[#4edea3]/20'
                              : 'bg-red-950/40 text-red-300 border-red-500/40 hover:bg-red-900/40'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              org.subscriptionStatus === 'active' ? 'bg-[#4edea3]' : 'bg-red-400'
                            }`}
                          />
                          <span>{org.subscriptionStatus === 'active' ? 'Actif' : 'Suspendu'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleManage(org.id)}
                          className="px-3 py-1.5 border border-[#334155] rounded text-on-surface hover:border-primary hover:text-primary transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>Gérer</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale Nouvelle Organisation */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-[#334155] rounded-xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-surface-container border-b border-[#334155] flex justify-between items-center">
              <h2 className="font-mono text-sm font-bold text-on-surface flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span>Créer une Nouvelle Organisation</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="p-5 flex flex-col gap-4 font-mono text-xs">
              {formError && (
                <div className="p-2.5 bg-red-950/40 border border-red-500/40 rounded text-red-200 text-[11px]">
                  {formError}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="uppercase text-on-surface">Nom de la Société *</label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Ex: TRANS-SAHEL LOGISTICS"
                  required
                  className="bg-[#020617] border border-[#334155] rounded py-2 px-3 text-on-surface focus:outline-none focus:border-[#ff8c00]"
                />
              </div>

              <div className="border-t border-[#334155] pt-3">
                <span className="text-[11px] text-on-surface-variant font-semibold block mb-2">
                  Administrateur Principal (Optionnel)
                </span>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    value={adminFirstName}
                    onChange={(e) => setAdminFirstName(e.target.value)}
                    placeholder="Prénom"
                    className="bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  />
                  <input
                    type="text"
                    value={adminLastName}
                    onChange={(e) => setAdminLastName(e.target.value)}
                    placeholder="Nom"
                    className="bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <input
                    type="tel"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="Téléphone (ex: +221 77 000 11 22)"
                    className="bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  />
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="Email"
                    className="bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  />
                  <input
                    type="text"
                    maxLength={4}
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="Code PIN à 4 chiffres (défaut : 1234)"
                    className="bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 border border-[#334155] rounded hover:bg-surface-variant"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newOrgName.trim()}
                  className="px-4 py-1.5 bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-semibold rounded disabled:opacity-50"
                >
                  {isSubmitting ? 'Création...' : 'Créer l’Organisation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
