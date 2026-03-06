import { create } from "zustand";
import type { Usuario } from "../types/index";
import { wsService } from "../services/websocket/index";

const USER_KEY = import.meta.env.VITE_USER_KEY;
const TOKEN_KEY_ENV = import.meta.env.VITE_TOKEN_KEY;

interface AuthState {
    token: string | null;
    usuario: Usuario | null;
    isAuthenticated: boolean;
    login: (token: string, usuario: Usuario) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>(set => ({
    token: localStorage.getItem(TOKEN_KEY_ENV),
    usuario: (() => {
        try {
            return JSON.parse(localStorage.getItem(USER_KEY) || "null");
        } catch {
            return null;
        }
    })(),
    isAuthenticated: !!localStorage.getItem(TOKEN_KEY_ENV),

    login: (token, usuario) => {
        localStorage.setItem(TOKEN_KEY_ENV, token);
        localStorage.setItem(USER_KEY, JSON.stringify(usuario));
        wsService.connect(token);
        set({ token, usuario, isAuthenticated: true });
    },

    logout: () => {
        localStorage.clear();
        wsService.disconnect();
        set({ token: null, usuario: null, isAuthenticated: false });
    },
}));
