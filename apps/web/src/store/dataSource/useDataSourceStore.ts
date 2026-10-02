import { create } from 'zustand';
import type { ImportedDataSource } from '../../operations/dataSource/dataSourceTypes.js';
import {
  savePersistedDataSource,
  clearPersistedDataSource,
  loadPersistedDataSource,
} from './dataSourceStorage.js';

export interface DataSourceState {
  dataSource: ImportedDataSource | null;
  activeRowIndex: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  setDataSource: (dataSource: ImportedDataSource | null) => void;
  clearDataSource: () => void;
  setActiveRowIndex: (index: number) => void;
  nextRow: () => void;
  prevRow: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  hydrateFromStorage: () => Promise<void>;
}

/**
 * Returns the active record row from an imported data source, safely clamping the index.
 * Returns null if no data source exists or if it has no rows.
 */
export function getActiveRow(
  dataSource: ImportedDataSource | null,
  activeRowIndex: number,
): Record<string, unknown> | null {
  if (!dataSource || !dataSource.rows || dataSource.rows.length === 0) {
    return null;
  }
  const clampedIndex = Math.max(0, Math.min(activeRowIndex, dataSource.rows.length - 1));
  return dataSource.rows[clampedIndex] ?? null;
}

export const useDataSourceStore = create<DataSourceState>((set) => ({
  dataSource: null,
  activeRowIndex: 0,
  isLoading: false,
  error: null,

  setDataSource: (dataSource) => {
    set({ dataSource, activeRowIndex: 0, error: null, isLoading: false });
    if (dataSource) {
      void savePersistedDataSource(dataSource);
    } else {
      void clearPersistedDataSource();
    }
  },

  clearDataSource: () => {
    set({ dataSource: null, activeRowIndex: 0, error: null, isLoading: false });
    void clearPersistedDataSource();
  },

  setActiveRowIndex: (index: number) => {
    set((state) => {
      const maxIndex = state.dataSource ? Math.max(0, state.dataSource.rows.length - 1) : 0;
      const clamped = Math.max(0, Math.min(index, maxIndex));
      return { activeRowIndex: clamped };
    });
  },

  nextRow: () => {
    set((state) => {
      if (!state.dataSource || state.dataSource.rows.length === 0) return state;
      const maxIndex = state.dataSource.rows.length - 1;
      return { activeRowIndex: Math.min(state.activeRowIndex + 1, maxIndex) };
    });
  },

  prevRow: () => {
    set((state) => {
      return { activeRowIndex: Math.max(0, state.activeRowIndex - 1) };
    });
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),

  hydrateFromStorage: async () => {
    try {
      const persisted = await loadPersistedDataSource();
      if (persisted && persisted.rows && persisted.columns) {
        set({ dataSource: persisted, activeRowIndex: 0, error: null });
      }
    } catch {
      // Ignore recovery errors gracefully
    }
  },
}));

