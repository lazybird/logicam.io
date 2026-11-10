import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, storage } from '../lib/api';
import type { Capability, OrganizationDTO, PreferenceKey, UserDTO } from '../../shared/types';
import { hasCapability } from '../../shared/permissions';

interface AuthContextValue {
  user: UserDTO | null;
  currentOrg: OrganizationDTO | null;
  organizations: OrganizationDTO[];
  isLoading: boolean;
  login: (phone: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [currentOrg, setCurrentOrg] = useState<OrganizationDTO | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await api.get<{
        user: UserDTO;
        currentOrganization: OrganizationDTO | null;
        organizations: OrganizationDTO[];
      }>('/api/auth/me');

      setUser(data.user);
      setCurrentOrg(data.currentOrganization);
      setOrganizations(data.organizations || []);

      if (data.currentOrganization) {
        storage.setActiveOrgId(data.currentOrganization.id);
      }
    } catch {
      setUser(null);
      setCurrentOrg(null);
      setOrganizations([]);
      storage.clear();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = storage.getToken();
    if (token) {
      refreshProfile();
    } else {
      setIsLoading(false);
    }
  }, [refreshProfile]);

  const login = async (phone: string, pin: string) => {
    setIsLoading(true);
    try {
      const res = await api.post<{
        token: string;
        user: UserDTO;
        currentOrganization: OrganizationDTO | null;
        organizations: OrganizationDTO[];
      }>('/api/auth/login', { phone, pin });

      storage.setToken(res.token);
      if (res.currentOrganization) {
        storage.setActiveOrgId(res.currentOrganization.id);
      }

      setUser(res.user);
      setCurrentOrg(res.currentOrganization);
      setOrganizations(res.organizations || []);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {}
    storage.clear();
    setUser(null);
    setCurrentOrg(null);
    setOrganizations([]);
  };

  const switchOrganization = async (orgId: string) => {
    const res = await api.post<{
      success: boolean;
      currentOrganization: OrganizationDTO;
    }>('/api/auth/switch-org', { organizationId: orgId });

    if (res.currentOrganization) {
      storage.setActiveOrgId(res.currentOrganization.id);
      setCurrentOrg(res.currentOrganization);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentOrg,
        organizations,
        isLoading,
        login,
        logout,
        switchOrganization,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook pour évaluer les politiques et préférences d'équipe de l'utilisateur actif
 */
export function useTeamPolicy() {
  const { user } = useAuth();

  const can = useCallback(
    (capability: Capability): boolean => {
      if (!user) return false;
      return hasCapability(user.role, user.capabilities, capability);
    },
    [user]
  );

  const getPreference = useCallback(
    (key: PreferenceKey): string | undefined => {
      if (!user?.preferences) return undefined;
      return user.preferences[key];
    },
    [user]
  );

  return { can, getPreference };
}
