import { create } from 'zustand';

/** Set right after the profile is created so the app can open the optional health / routine setup steps once. */
export const useSetupPending = create<{ pending: boolean; set: (v: boolean) => void }>((set) => ({ pending: false, set: (pending) => set({ pending }) }));
