import React, { useState, useEffect } from 'react';
import { useAuth, useTeamPolicy } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Layout, type NavTab } from './components/Layout';
import { FleetDashboard } from './pages/FleetDashboard';
import { SuperAdminOrgs } from './pages/SuperAdminOrgs';
import { OrgAdminPage } from './pages/OrgAdminPage';
import { CouplingModal } from './components/CouplingModal';
import { api } from './lib/api';
import { useRouter } from './hooks/useRouter';
import type { TractorDTO, TrailerDTO } from '../shared/types';

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { getPreference } = useTeamPolicy();
  const { currentTab, setCurrentTab } = useRouter('fleet');

  // Modale globale d'attelage déclenchable depuis la sidebar
  const [isCouplingModalOpen, setIsCouplingModalOpen] = useState(false);
  const [tractors, setTractors] = useState<TractorDTO[]>([]);
  const [trailers, setTrailers] = useState<TrailerDTO[]>([]);

  // Définir l'onglet par défaut au chargement si aucune URL spécifique n'a été saisie
  useEffect(() => {
    if (user && (window.location.pathname === '/' || window.location.pathname === '')) {
      if (user.role === 'SUPER_ADMIN') {
        setCurrentTab('fleet', true);
      } else {
        const prefView = getPreference('default_view');
        if (prefView === 'fleet' || prefView === 'dashboard') {
          setCurrentTab('fleet', true);
        }
      }
    }
  }, [user, getPreference, setCurrentTab]);

  // Chargement des véhicules pour la modale globale d'attelage
  const loadFleetVehicles = async () => {
    try {
      const res = await api.get<{ tractors: TractorDTO[]; trailers: TrailerDTO[] }>('/api/fleet');
      setTractors(res.tractors || []);
      setTrailers(res.trailers || []);
    } catch {}
  };

  const handleOpenCouplingModal = () => {
    loadFleetVehicles();
    setIsCouplingModalOpen(true);
  };

  // Écran de chargement initial
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0b1326] text-on-surface flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-4 h-4 rounded-sm bg-[#ff8c00] animate-ping" />
          <span className="font-mono text-2xl font-bold tracking-tight text-[#ffb77d]">
            LogiCam.io
          </span>
        </div>
        <p className="font-mono text-xs text-on-surface-variant">Chargement du système...</p>
      </div>
    );
  }

  // Écran d'authentification par PIN
  if (!user) {
    return <LoginPage />;
  }

  // Application connectée
  return (
    <Layout
      currentTab={currentTab}
      onNavigate={(tab) => setCurrentTab(tab)}
      onOpenCouplingModal={handleOpenCouplingModal}
    >
      {currentTab === 'fleet' && <FleetDashboard />}

      {currentTab === 'super-admin-orgs' && (
        <SuperAdminOrgs
          onManageOrg={() => {
            setCurrentTab('fleet');
          }}
        />
      )}

      {currentTab === 'admin' && <OrgAdminPage />}

      {/* Modale d'attelage accessible depuis la SideBar */}
      {isCouplingModalOpen && (
        <CouplingModal
          isOpen={isCouplingModalOpen}
          onClose={() => setIsCouplingModalOpen(false)}
          tractors={tractors}
          trailers={trailers}
          onSuccess={() => {
            // Recharger si on est sur la flotte
            loadFleetVehicles();
          }}
        />
      )}
    </Layout>
  );
};
