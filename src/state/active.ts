import { create } from 'zustand';

/** Whose data is on screen: null = me, otherwise a family member's id. Kept in memory, so the app always opens on "me". */
export const useActiveMember = create<{ memberId: string | null; setMemberId: (id: string | null) => void }>((set) => ({
  memberId: null,
  setMemberId: (memberId) => set({ memberId }),
}));
