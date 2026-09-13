import { create } from 'zustand';
import type { ImportedDataSource } from '../../operations/dataSource/dataSourceTypes.js';
import {
  savePersistedDataSource,
  clearPersistedDataSource,
  loadPersistedDataSource,
} from './dataSourceStorage.js';

export interface DataSourceState {
  dataSource: ImportedDataSource | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setDataSource: (dataSource: ImportedDataSource | null) => void;
  clearDataSource: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  hydrateFromStorage: () => Promise<void>;
}

export const useDataSourceStore = create<DataSourceState>((set) => ({
  dataSource: null,
  isLoading: false,
  error: null,

  setDataSource: (dataSource) => {
    set({ dataSource, error: null, isLoading: false });
    if (dataSource) {
      void savePersistedDataSource(dataSource);
    } else {
      void clearPersistedDataSource();
    }
  },

  clearDataSource: () => {
    set({ dataSource: null, error: null, isLoading: false });
    void clearPersistedDataSource();
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),

  hydrateFromStorage: async () => {
    try {
      const persisted = await loadPersistedDataSource();
      if (persisted && persisted.rows && persisted.columns) {
        set({ dataSource: persisted, error: null });
      }
    } catch {
      // Ignore recovery errors gracefully
    }
  },
}));

