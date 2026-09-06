import { create } from 'zustand';

interface RecoveryStoreState {
  recoveryMessage: string | null;
  setRecoveryMessage: (msg: string | null) => void;
  dismissRecoveryMessage: () => void;
}

export const useRecoveryStore = create<RecoveryStoreState>((set) => ({
  recoveryMessage: null,
  setRecoveryMessage: (recoveryMessage) => set({ recoveryMessage }),
  dismissRecoveryMessage: () => set({ recoveryMessage: null }),
}));

