import { create } from 'zustand';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string | null;
  tenantId: string | null;
  plantId: string | null;
  warehouseId: string | null;
  roles: string[];
}

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  setLoading: () => void;
  setAuthenticated: (user: AuthUser) => void;
  setUnauthenticated: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  setLoading: () => set({ status: 'loading' }),
  setAuthenticated: (user) => set({ status: 'authenticated', user }),
  setUnauthenticated: () => set({ status: 'unauthenticated', user: null }),
}));
