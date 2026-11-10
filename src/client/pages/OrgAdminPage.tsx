import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  AlertTriangle,
  Wrench,
  Plus,
  Search,
  Check,
  X,
  Trash2,
  Lock,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, useTeamPolicy } from '../context/AuthContext';
import { AVAILABLE_CAPABILITIES } from '../../shared/permissions';
import type {
  BreakdownCategoryDTO,
  Capability,
  GarageDTO,
  TeamDTO,
  UserRole,
} from '../../shared/types';

interface MemberItem {
  id: string;
  organizationId: string;
  teamId: string | null;
  teamName: string | null;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: 'active' | 'inactive';
  lastLoginAt: string | null;
  createdAt: string;
}

interface AdminOverviewResponse {
  members: MemberItem[];
  teams: TeamDTO[];
  breakdownCategories: BreakdownCategoryDTO[];
  garages: GarageDTO[];
}

export const OrgAdminPage: React.FC = () => {
  const { currentOrg } = useAuth();
  const { can } = useTeamPolicy();

  const [activeTab, setActiveTab] = useState<'members' | 'teams' | 'categories' | 'garages'>('members');
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Recherche membres
  const [memberSearch, setMemberSearch] = useState('');

  // Modale Ajout Membre
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('MEMBER');
  const [newTeamId, setNewTeamId] = useState('');
  const [newPin, setNewPin] = useState('1234');
  const [submittingMember, setSubmittingMember] = useState(false);

  // Équipe sélectionnée dans l'onglet Équipes & Permissions
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [editingCapabilities, setEditingCapabilities] = useState<Capability[]>([]);
  const [editingDefaultView, setEditingDefaultView] = useState<string>('dashboard');
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policySavedNotice, setPolicySavedNotice] = useState(false);

  // Modale Nouvelle Équipe
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');

  // Ajout Catégorie
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatSeverity, setNewCatSeverity] = useState('medium');

  // Ajout Garage
  const [newGarName, setNewGarName] = useState('');
  const [newGarLocation, setNewGarLocation] = useState('');
  const [newGarPhone, setNewGarPhone] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get<AdminOverviewResponse>('/api/admin/overview');
      setData(res);

      // Initialiser la première équipe si aucune n'est sélectionnée
      if (res.teams.length > 0 && !selectedTeamId) {
        setSelectedTeamId(res.teams[0].id);
        setEditingCapabilities(res.teams[0].capabilities || []);
        setEditingDefaultView(res.teams[0].preferences?.default_view || 'dashboard');
      }
    } catch (err: any) {
      console.error('Erreur chargement admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentOrg?.id]);

  // Synchronisation des permissions quand l'équipe sélectionnée change
  const handleSelectTeam = (t: TeamDTO) => {
    setSelectedTeamId(t.id);
    setEditingCapabilities(t.capabilities || []);
    setEditingDefaultView(t.preferences?.default_view || 'dashboard');
    setPolicySavedNotice(false);
  };

  const handleToggleCapability = (cap: Capability) => {
    setEditingCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  const handleSaveTeamPolicy = async () => {
    if (!selectedTeamId) return;
    setSavingPolicy(true);
    try {
      await api.put(`/api/admin/teams/${selectedTeamId}/policy`, {
        capabilities: editingCapabilities,
        preferences: {
          default_view: editingDefaultView,
        },
      });

      setPolicySavedNotice(true);
      setTimeout(() => setPolicySavedNotice(false), 3000);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSavingPolicy(false);
    }
  };

  // Création membre
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim() || !newPhone.trim()) return;

    setSubmittingMember(true);
    try {
      await api.post('/api/admin/members', {
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || undefined,
        role: newRole,
        teamId: newTeamId || undefined,
        pin: newPin.trim() || '1234',
      });

      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      setNewEmail('');
      setNewPin('1234');
      setIsAddMemberOpen(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Erreur lors de la création du membre');
    } finally {
      setSubmittingMember(false);
    }
  };

  // Bascule statut membre
  const handleToggleMemberStatus = async (m: MemberItem) => {
    const nextStatus = m.status === 'active' ? 'inactive' : 'active';
    try {
      await api.patch(`/api/admin/members/${m.id}`, { status: nextStatus });
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Erreur');
    }
  };

  // Réinitialisation code PIN membre
  const handleResetPin = async (m: MemberItem) => {
    const pin = prompt(`Nouveau code PIN à 4 chiffres pour ${m.firstName} ${m.lastName} :`, '1234');
    if (!pin || pin.length !== 4) return;

    try {
      await api.patch(`/api/admin/members/${m.id}`, { pin });
      alert(`Code PIN réinitialisé avec succès pour ${m.firstName} ${m.lastName}.`);
    } catch (err: any) {
      alert(err?.message || 'Erreur lors de la réinitialisation du PIN');
    }
  };

  // Création d'équipe
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    try {
      const res = await api.post<TeamDTO>('/api/admin/teams', {
        name: newTeamName.trim(),
        description: newTeamDesc.trim() || undefined,
        capabilities: ['fleet:read'],
      });

      setNewTeamName('');
      setNewTeamDesc('');
      setIsAddTeamOpen(false);
      loadData();
      setSelectedTeamId(res.id);
    } catch (err: any) {
      alert(err?.message || 'Erreur création équipe');
    }
  };

  // Catégories
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !newCatCode.trim()) return;

    try {
      await api.post('/api/admin/categories', {
        name: newCatName.trim(),
        code: newCatCode.trim().toUpperCase(),
        severity: newCatSeverity,
      });

      setNewCatName('');
      setNewCatCode('');
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Erreur');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Supprimer cette catégorie de panne ?')) return;
    try {
      await api.delete(`/api/admin/categories/${id}`);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Erreur');
    }
  };

  // Garages
  const handleCreateGarage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGarName.trim()) return;

    try {
      await api.post('/api/admin/garages', {
        name: newGarName.trim(),
        location: newGarLocation.trim() || undefined,
        contactPhone: newGarPhone.trim() || undefined,
      });

      setNewGarName('');
      setNewGarLocation('');
      setNewGarPhone('');
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Erreur');
    }
  };

  const handleDeleteGarage = async (id: string) => {
    if (!confirm('Supprimer ce garage ?')) return;
    try {
      await api.delete(`/api/admin/garages/${id}`);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Erreur');
    }
  };

  const filteredMembers = (data?.members || []).filter((m) => {
    if (!memberSearch.trim()) return true;
    const term = memberSearch.toLowerCase();
    return (
      m.firstName.toLowerCase().includes(term) ||
      m.lastName.toLowerCase().includes(term) ||
      m.phone.toLowerCase().includes(term) ||
      m.email?.toLowerCase().includes(term) ||
      m.teamName?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold text-on-surface">
            Administration — {currentOrg?.name}
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Gestion des membres, équipes, permissions d'accès, catégories et garages
          </p>
        </div>

        {activeTab === 'members' && can('members:manage') && (
          <button
            type="button"
            onClick={() => setIsAddMemberOpen(true)}
            className="px-4 py-2 bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-mono text-xs font-semibold rounded flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(255,140,0,0.3)]"
          >
            <Plus className="w-4 h-4" />
            <span>AJOUTER UN MEMBRE</span>
          </button>
        )}
      </div>

      {/* 4 Onglets de navigation */}
      <div className="flex gap-2 border-b border-[#334155] font-mono text-xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`pb-3 px-3 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'members'
              ? 'border-b-2 border-[#ff8c00] text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Gestion des Membres ({data?.members.length ?? 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('teams')}
          className={`pb-3 px-3 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'teams'
              ? 'border-b-2 border-[#ff8c00] text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Équipes & Permissions ({data?.teams.length ?? 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`pb-3 px-3 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'categories'
              ? 'border-b-2 border-[#ff8c00] text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Catégories de Pannes ({data?.breakdownCategories.length ?? 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('garages')}
          className={`pb-3 px-3 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'garages'
              ? 'border-b-2 border-[#ff8c00] text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Garages Partenaires ({data?.garages.length ?? 0})</span>
        </button>
      </div>

      {/* Onglet 1 : Gestion des Membres */}
      {activeTab === 'members' && (
        <div className="bg-surface-container border border-[#334155] rounded overflow-hidden flex flex-col">
          {/* Recherche */}
          <div className="p-3 md:p-4 bg-surface border-b border-[#334155] flex justify-between items-center">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Rechercher un membre..."
                className="w-full bg-[#020617] border border-[#334155] rounded pl-9 pr-3 py-1.5 font-mono text-xs text-on-surface focus:outline-none focus:border-[#ff8c00]"
              />
            </div>
          </div>

          {/* Table des Membres */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="bg-surface-container-low border-b border-[#334155]">
                  <th className="py-3 px-4 uppercase text-on-surface-variant font-medium">
                    NOM & PRÉNOM
                  </th>
                  <th className="py-3 px-4 uppercase text-on-surface-variant font-medium">TÉLÉPHONE</th>
                  <th className="py-3 px-4 uppercase text-on-surface-variant font-medium">
                    ÉQUIPE / RÔLE
                  </th>
                  <th className="py-3 px-4 uppercase text-on-surface-variant font-medium">STATUT</th>
                  <th className="py-3 px-4 uppercase text-on-surface-variant font-medium">
                    DERNIER ACCÈS
                  </th>
                  <th className="py-3 px-4 uppercase text-on-surface-variant font-medium text-right">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/40">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                      Aucun membre trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-surface-variant/30 transition-colors bg-surface"
                    >
                      <td className="py-3 px-4 text-on-surface font-semibold">
                        {m.firstName} {m.lastName}
                        {m.email && (
                          <span className="block text-[10px] text-on-surface-variant font-sans font-normal">
                            {m.email}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant">{m.phone}</td>
                      <td className="py-3 px-4">
                        {m.role === 'ORG_ADMIN' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-[#ff8c00]/20 text-[#ffb77d] border border-[#ff8c00]/30 font-semibold">
                            Administrateur
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-surface-container-high border border-[#334155] text-on-surface-variant">
                            {m.teamName || 'Sans équipe'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleMemberStatus(m)}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] border transition-colors ${
                            m.status === 'active'
                              ? 'bg-[#4edea3]/10 text-[#4edea3] border-[#4edea3]/30 hover:bg-[#4edea3]/20'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              m.status === 'active' ? 'bg-[#4edea3]' : 'bg-zinc-500'
                            }`}
                          />
                          <span>{m.status === 'active' ? 'Actif' : 'Inactif'}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant text-[11px]">
                        {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : 'Jamais'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {can('members:manage') && (
                          <button
                            type="button"
                            onClick={() => handleResetPin(m)}
                            className="px-2.5 py-1 rounded border border-[#334155] hover:border-primary text-[10px] text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-1"
                            title="Réinitialiser le code PIN"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Reset PIN</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onglet 2 : Équipes & Permissions (Matrice Vazy) */}
      {activeTab === 'teams' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Liste des Équipes */}
          <div className="lg:col-span-1 bg-surface-container border border-[#334155] rounded p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center mb-1">
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-on-surface">
                Équipes ({data?.teams.length})
              </h2>
              {can('members:manage') && (
                <button
                  type="button"
                  onClick={() => setIsAddTeamOpen(true)}
                  className="p-1 rounded hover:bg-surface-variant text-primary"
                  title="Créer une équipe"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {(data?.teams || []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTeam(t)}
                  className={`p-3 rounded text-left transition-colors font-mono text-xs flex flex-col gap-1 ${
                    selectedTeamId === t.id
                      ? 'bg-[#ff8c00] text-black font-semibold'
                      : 'bg-surface hover:bg-surface-variant border border-[#334155] text-on-surface'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{t.name}</span>
                    <span className="text-[10px] opacity-75">{t.membersCount ?? 0} membres</span>
                  </div>
                  {t.description && (
                    <span className="text-[10px] opacity-75 font-sans truncate">{t.description}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Matrice des Permissions pour l'équipe sélectionnée */}
          <div className="lg:col-span-3 bg-surface border border-[#334155] rounded p-5 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-[#334155]">
              <div>
                <h3 className="font-mono text-base font-bold text-on-surface flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>
                    Permissions de l'équipe :{' '}
                    {data?.teams.find((t) => t.id === selectedTeamId)?.name}
                  </span>
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Cochez les droits attribués à tous les membres de cette équipe
                </p>
              </div>

              <div className="flex items-center gap-3">
                {policySavedNotice && (
                  <span className="text-[#4edea3] font-mono text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Enregistré !
                  </span>
                )}
                {can('members:manage') && (
                  <button
                    type="button"
                    onClick={handleSaveTeamPolicy}
                    disabled={savingPolicy}
                    className="px-4 py-2 bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-mono text-xs font-semibold rounded flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(255,140,0,0.25)]"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingPolicy ? 'Sauvegarde...' : 'Enregistrer'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Vue par défaut */}
            <div className="flex items-center gap-4 bg-surface-container p-3 rounded border border-[#334155] font-mono text-xs">
              <span className="text-on-surface-variant">Vue d'accueil par défaut :</span>
              <select
                value={editingDefaultView}
                onChange={(e) => setEditingDefaultView(e.target.value)}
                className="bg-[#020617] border border-[#334155] rounded py-1 px-3 text-on-surface focus:outline-none"
              >
                <option value="dashboard">Tableau de bord</option>
                <option value="fleet">État du Parc</option>
                <option value="incidents">Incidents & Réparations</option>
              </select>
            </div>

            {/* Grille des Capabilities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AVAILABLE_CAPABILITIES.map((cap) => {
                const isChecked = editingCapabilities.includes(cap.id);

                return (
                  <div
                    key={cap.id}
                    onClick={() => handleToggleCapability(cap.id)}
                    className={`p-3 rounded border cursor-pointer transition-all flex items-start gap-3 select-none ${
                      isChecked
                        ? 'bg-[#ff8c00]/10 border-[#ff8c00]/40'
                        : 'bg-surface-container border-[#334155] hover:bg-surface-variant'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 border ${
                        isChecked
                          ? 'bg-[#ff8c00] border-[#ff8c00] text-black'
                          : 'border-[#334155] bg-[#020617]'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <div className="font-mono text-xs font-semibold text-on-surface">
                        {cap.label}
                      </div>
                      <div className="text-[11px] text-on-surface-variant font-sans">
                        {cap.description}
                      </div>
                      <div className="font-mono text-[9px] text-primary/70">{cap.id}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Onglet 3 : Catégories de Pannes */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulaire ajout rapide */}
          {can('settings:manage') && (
            <div className="bg-surface-container border border-[#334155] rounded p-4 flex flex-col gap-4 font-mono text-xs">
              <h3 className="font-bold uppercase text-on-surface flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                <span>Nouvelle Catégorie</span>
              </h3>

              <form onSubmit={handleCreateCategory} className="flex flex-col gap-3">
                <div>
                  <label className="text-on-surface-variant block mb-1">Nom</label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Ex: Système Hydraulique"
                    required
                    className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-on-surface-variant block mb-1">Code</label>
                  <input
                    type="text"
                    value={newCatCode}
                    onChange={(e) => setNewCatCode(e.target.value)}
                    placeholder="Ex: HYDRAULIC"
                    required
                    className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-on-surface-variant block mb-1">Sévérité</label>
                  <select
                    value={newCatSeverity}
                    onChange={(e) => setNewCatSeverity(e.target.value)}
                    className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  >
                    <option value="low">Faible</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Élevée</option>
                    <option value="critical">Critique</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="mt-2 py-2 bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-semibold rounded"
                >
                  Ajouter la catégorie
                </button>
              </form>
            </div>
          )}

          {/* Liste des catégories */}
          <div className="lg:col-span-2 bg-surface border border-[#334155] rounded overflow-hidden">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="bg-surface-container-low border-b border-[#334155]">
                  <th className="py-2.5 px-3 uppercase text-on-surface-variant font-medium">NOM</th>
                  <th className="py-2.5 px-3 uppercase text-on-surface-variant font-medium">CODE</th>
                  <th className="py-2.5 px-3 uppercase text-on-surface-variant font-medium">SÉVÉRITÉ</th>
                  <th className="py-2.5 px-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/40">
                {(data?.breakdownCategories || []).map((cat) => (
                  <tr key={cat.id} className="hover:bg-surface-variant/30">
                    <td className="py-2.5 px-3 font-semibold text-on-surface">{cat.name}</td>
                    <td className="py-2.5 px-3 text-primary">{cat.code}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-surface-container border border-[#334155]">
                        {cat.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {can('settings:manage') && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1 text-on-surface-variant hover:text-red-400"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onglet 4 : Garages */}
      {activeTab === 'garages' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulaire ajout garage */}
          {can('settings:manage') && (
            <div className="bg-surface-container border border-[#334155] rounded p-4 flex flex-col gap-4 font-mono text-xs">
              <h3 className="font-bold uppercase text-on-surface flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                <span>Nouveau Garage Partenaire</span>
              </h3>

              <form onSubmit={handleCreateGarage} className="flex flex-col gap-3">
                <div>
                  <label className="text-on-surface-variant block mb-1">Nom du Garage</label>
                  <input
                    type="text"
                    value={newGarName}
                    onChange={(e) => setNewGarName(e.target.value)}
                    placeholder="Ex: Atelier Mécanique Rufisque"
                    required
                    className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-on-surface-variant block mb-1">Localisation</label>
                  <input
                    type="text"
                    value={newGarLocation}
                    onChange={(e) => setNewGarLocation(e.target.value)}
                    placeholder="Ex: KM 18 Route Nationale"
                    className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-on-surface-variant block mb-1">Téléphone de Contact</label>
                  <input
                    type="tel"
                    value={newGarPhone}
                    onChange={(e) => setNewGarPhone(e.target.value)}
                    placeholder="Ex: +221 33 800 00 00"
                    className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="mt-2 py-2 bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-semibold rounded"
                >
                  Ajouter le garage
                </button>
              </form>
            </div>
          )}

          {/* Liste des garages */}
          <div className="lg:col-span-2 bg-surface border border-[#334155] rounded overflow-hidden">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="bg-surface-container-low border-b border-[#334155]">
                  <th className="py-2.5 px-3 uppercase text-on-surface-variant font-medium">GARAGE</th>
                  <th className="py-2.5 px-3 uppercase text-on-surface-variant font-medium">
                    LOCALISATION
                  </th>
                  <th className="py-2.5 px-3 uppercase text-on-surface-variant font-medium">
                    TÉLÉPHONE
                  </th>
                  <th className="py-2.5 px-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/40">
                {(data?.garages || []).map((gar) => (
                  <tr key={gar.id} className="hover:bg-surface-variant/30">
                    <td className="py-2.5 px-3 font-semibold text-on-surface">{gar.name}</td>
                    <td className="py-2.5 px-3 text-on-surface-variant">{gar.location || 'N/A'}</td>
                    <td className="py-2.5 px-3 text-primary">{gar.contactPhone || 'N/A'}</td>
                    <td className="py-2.5 px-3 text-right">
                      {can('settings:manage') && (
                        <button
                          type="button"
                          onClick={() => handleDeleteGarage(gar.id)}
                          className="p-1 text-on-surface-variant hover:text-red-400"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modale Ajout Membre */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-[#334155] rounded-xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-surface-container border-b border-[#334155] flex justify-between items-center">
              <h2 className="font-mono text-sm font-bold text-on-surface flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Ajouter un Membre</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="p-5 flex flex-col gap-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-on-surface-variant block mb-1">Prénom *</label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    required
                    className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-on-surface-variant block mb-1">Nom *</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    required
                    className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-on-surface-variant block mb-1">Téléphone *</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+221 77 000 00 00"
                  required
                  className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                />
              </div>

              <div>
                <label className="text-on-surface-variant block mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-on-surface-variant block mb-1">Rôle</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  >
                    <option value="MEMBER">Membre</option>
                    <option value="ORG_ADMIN">Admin Organisation</option>
                  </select>
                </div>

                <div>
                  <label className="text-on-surface-variant block mb-1">Équipe</label>
                  <select
                    value={newTeamId}
                    onChange={(e) => setNewTeamId(e.target.value)}
                    className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                  >
                    <option value="">Aucune</option>
                    {(data?.teams || []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-on-surface-variant block mb-1">Code PIN (4 chiffres)</label>
                <input
                  type="text"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="1234"
                  className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-3 py-1.5 border border-[#334155] rounded hover:bg-surface-variant"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingMember}
                  className="px-4 py-1.5 bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-semibold rounded"
                >
                  {submittingMember ? 'Ajout...' : 'Créer le Membre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Nouvelle Équipe */}
      {isAddTeamOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-[#334155] rounded-xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-surface-container border-b border-[#334155] flex justify-between items-center">
              <h2 className="font-mono text-sm font-bold text-on-surface">Créer une Équipe</h2>
              <button
                type="button"
                onClick={() => setIsAddTeamOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="p-4 flex flex-col gap-3 font-mono text-xs">
              <div>
                <label className="text-on-surface-variant block mb-1">Nom de l’équipe *</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Ex: Dispatching Nuit"
                  required
                  className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                />
              </div>

              <div>
                <label className="text-on-surface-variant block mb-1">Description</label>
                <textarea
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-[#020617] border border-[#334155] rounded py-1.5 px-2.5 text-on-surface focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsAddTeamOpen(false)}
                  className="px-3 py-1.5 border border-[#334155] rounded"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#ff8c00] hover:bg-[#ff8c00]/90 text-black font-semibold rounded"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
