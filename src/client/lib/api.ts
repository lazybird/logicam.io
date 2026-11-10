export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const TOKEN_KEY = 'logicam_token';
const ACTIVE_ORG_KEY = 'logicam_active_org_id';

export const storage = {
  getToken: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken: (token: string | null) => {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {}
  },
  getActiveOrgId: (): string | null => {
    try {
      return localStorage.getItem(ACTIVE_ORG_KEY);
    } catch {
      return null;
    }
  },
  setActiveOrgId: (orgId: string | null) => {
    try {
      if (orgId) {
        localStorage.setItem(ACTIVE_ORG_KEY, orgId);
      } else {
        localStorage.removeItem(ACTIVE_ORG_KEY);
      }
    } catch {}
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ACTIVE_ORG_KEY);
    } catch {}
  },
};

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = storage.getToken();
  const activeOrgId = storage.getActiveOrgId();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (activeOrgId) {
    headers['X-Organization-Id'] = activeOrgId;
  }

  // Si on envoie du JSON et que Content-Type n'est pas déjà spécifié (ex: FormData)
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401 && endpoint !== '/api/auth/login') {
    // Si la session est expirée ou invalide, nettoyer
    storage.clear();
  }

  if (!response.ok) {
    let errorMsg = `Erreur HTTP ${response.status}`;
    let data = null;
    try {
      data = await response.json();
      if (data?.error) {
        errorMsg = data.error;
      }
    } catch {}

    throw new ApiError(errorMsg, response.status, data);
  }

  // Si statut 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
};
