import { create } from "zustand";
import type { View } from "../types";

interface NavigationState {
    activeView: View;
    navigate: (view: View) => void;
}

export const useNavigationStore = create<NavigationState>(set => ({
    activeView: "dashboard",
    navigate: view => set({ activeView: view }),
}));
