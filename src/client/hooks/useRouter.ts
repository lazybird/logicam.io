import { useState, useEffect, useCallback } from 'react';
import type { NavTab } from '../components/Layout';

const VALID_TABS: NavTab[] = ['fleet', 'super-admin-orgs', 'admin'];

function getPathForTab(tab: NavTab): string {
  switch (tab) {
    case 'super-admin-orgs':
      return '/super-admin';
    case 'admin':
      return '/admin';
    case 'fleet':
    default:
      return '/fleet';
  }
}

function getTabFromPath(pathname: string): NavTab | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/super-admin' || clean.startsWith('/super-admin/')) {
    return 'super-admin-orgs';
  }
  if (clean === '/admin' || clean.startsWith('/admin/')) {
    return 'admin';
  }
  if (clean === '/fleet' || clean.startsWith('/fleet/')) {
    return 'fleet';
  }
  return null;
}

export function useRouter(defaultTab: NavTab = 'fleet') {
  const [currentTab, setCurrentTabState] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      const parsed = getTabFromPath(window.location.pathname);
      if (parsed) return parsed;
    }
    return defaultTab;
  });

  // Synchronisation lors de l'action popstate (boutons précédent / suivant du navigateur)
  useEffect(() => {
    const handlePopState = () => {
      const tab = getTabFromPath(window.location.pathname);
      if (tab) {
        setCurrentTabState(tab);
      } else {
        // Racine ou URL inconnue -> onglet par défaut
        setCurrentTabState('fleet');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Navigation avec mise à jour de l'URL dans l'historique
  const navigate = useCallback((tab: NavTab, replace = false) => {
    setCurrentTabState(tab);
    const targetPath = getPathForTab(tab);

    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({ tab }, '', targetPath);
      } else {
        window.history.pushState({ tab }, '', targetPath);
      }
    }
  }, []);

  // Initialisation de l'URL au chargement si on est sur la racine "/"
  useEffect(() => {
    if (window.location.pathname === '/' || window.location.pathname === '') {
      const targetPath = getPathForTab(currentTab);
      window.history.replaceState({ tab: currentTab }, '', targetPath);
    }
  }, [currentTab]);

  return {
    currentTab,
    setCurrentTab: navigate,
  };
}
