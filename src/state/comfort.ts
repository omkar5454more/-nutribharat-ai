import { create } from 'zustand';

/**
 * Comfort Mode: a calm, low-stimulation view the person opens themselves (e.g. during a migraine). It does not treat anything.
 * While active, animations are off and non-essential notifications are muted. Memory only: the app always starts in normal mode.
 */
export const useComfort = create<{ active: boolean; enter: () => void; exit: () => void }>((set) => ({
  active: false,
  enter: () => set({ active: true }),
  exit: () => set({ active: false }),
}));
