/**
 * store/authStore.ts – User identity, persisted in localStorage.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,

      setAuth: (user, token) => {
        localStorage.setItem("access_token", token);
        localStorage.setItem("user", JSON.stringify(user));
        set({ user, token });
      },

      clearAuth: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        set({ user: null, token: null });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

export const isAuthenticated = () => {
  const state = useAuthStore.getState();
  return !!state.token && !!state.user;
};
