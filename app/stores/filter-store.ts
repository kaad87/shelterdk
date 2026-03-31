import { create } from "zustand";

interface FilterState {
  activeFilters: string[];
  toggle: (key: string) => void;
  clear: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  activeFilters: [],
  toggle: (key) =>
    set((state) => ({
      activeFilters: state.activeFilters.includes(key)
        ? state.activeFilters.filter((k) => k !== key)
        : [...state.activeFilters, key],
    })),
  clear: () => set({ activeFilters: [] }),
}));
