import { useEffect, useRef } from 'react';
import { useTemplateStore } from '../store/useTemplateStore.js';
import { useDocumentStore } from '../store/document/useDocumentStore.js';
import { useRecoveryStore } from '../store/recovery/useRecoveryStore.js';
import {
  loadSessionRecovery,
  restoreSessionRecovery,
  saveSessionRecovery,
} from '../store/recovery/sessionRecovery.js';

const DEBOUNCE_MS = 750;

/**
 * Hook that orchestrates session recovery on initial mount and manages
 * debounced session persistence as document mutations occur.
 *
 * NOTE: This is strictly for browser refresh/crash recovery, NOT Auto Save.
 */
export function useSessionRecovery(): void {
  const setRecoveryMessage = useRecoveryStore((s) => s.setRecoveryMessage);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function initRecovery() {
      try {
        const record = await loadSessionRecovery();
        if (record && isMounted) {
          const result = restoreSessionRecovery(record);
          if (result.recovered) {
            setRecoveryMessage(
              result.isDirty ? 'Recovered unsaved changes' : 'Recovered previous session',
            );
          }
        }
      } catch (err) {
        console.warn('Session recovery failed to load, starting fresh:', err);
      } finally {
        if (isMounted) {
          isInitializedRef.current = true;
        }
      }
    }

    initRecovery();

    // Subscribe to template changes for debounced persistence
    const unsubscribe = useTemplateStore.subscribe((state, prevState) => {
      // Don't persist before initial recovery check is done
      if (!isInitializedRef.current) return;
      // Skip if template reference did not change
      if (state.template === prevState.template) return;

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        const currentTemplate = useTemplateStore.getState().template;
        const docStore = useDocumentStore.getState();
        const isDirty = docStore.checkDirty(currentTemplate);

        saveSessionRecovery({
          template: currentTemplate,
          savedBaseline: docStore.savedBaseline,
          filename: docStore.filename,
          isDirty,
          assets: docStore.assets,
          hasSavedFile: Boolean(docStore.fileHandle),
          traceBackground: docStore.traceBackgroundFile,
        });
      }, DEBOUNCE_MS);
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [setRecoveryMessage]);
}

