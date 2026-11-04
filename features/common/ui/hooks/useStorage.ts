/**
 * @file Reactive Chrome Storage Hook for Preact
 * @module features/common/ui/hooks/useStorage
 * @context Shared Preact Hook (Options Pages, Popup, Analytics, Dashboard)
 * @description Provides reactive two-way binding between Preact components and `chrome.storage.local`.
 * Automatically synchronizes state when changes occur in other contexts via `chrome.storage.onChanged`.
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import { Logger } from '@common/logger';

/**
 * Custom Preact hook for reactive two-way binding with `chrome.storage.local`.
 *
 * Automatically fetches the initial stored value, listens for changes dispatched from other
 * extension contexts (background service worker, content scripts, or other tabs), and synchronizes
 * updates back to `chrome.storage.local`.
 *
 * @template T - The schema type of the stored item.
 * @param key - The string key in `chrome.storage.local`.
 * @param defaultValue - Fallback default value used if key does not yet exist in storage.
 * @returns A tuple of `[value, setValue, loading]` similar to standard `useState`, plus async persistence.
 * @listens chrome.storage.onChanged
 * @fires chrome.storage.local.set
 */
export function useStorage<T>(
    key: string,
    defaultValue: T
): [T, (newValue: T | ((prev: T) => T)) => Promise<void>, boolean] {
    const [value, setValue] = useState<T>(defaultValue);
    const [loading, setLoading] = useState<boolean>(true);

    // Initial fetch from chrome.storage.local
    useEffect(() => {
        let isMounted = true;
        try {
            chrome.storage.local.get([key], (result) => {
                try {
                    if (chrome.runtime?.lastError) {
                        Logger.error('useStorage', `Error reading ${key}: ${chrome.runtime.lastError.message}`);
                    } else if (isMounted && result && result[key] !== undefined) {
                        setValue(result[key] as T);
                    }
                } catch (err) {
                    Logger.error('useStorage', `Exception processing read for ${key}`, { err });
                } finally {
                    if (isMounted) setLoading(false);
                }
            });
        } catch (err) {
            Logger.error('useStorage', `Failed to invoke storage.get for ${key}`, { err });
            setLoading(false);
        }

        // Listener for cross-context storage updates
        const handleStorageChange = (
            changes: { [key: string]: chrome.storage.StorageChange },
            areaName: string
        ) => {
            if (areaName === 'local' && changes[key] && isMounted) {
                setValue(changes[key].newValue as T);
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);

        return () => {
            isMounted = false;
            try {
                chrome.storage.onChanged.removeListener(handleStorageChange);
            } catch {
                // Ignore listener removal error on unmount
            }
        };
    }, [key]);

    // Setter that updates chrome.storage.local
    const updateValue = useCallback(
        async (newValueOrUpdater: T | ((prev: T) => T)): Promise<void> => {
            try {
                let resolvedValue: T;
                if (typeof newValueOrUpdater === 'function') {
                    // Fetch latest from storage to prevent stale closure updates
                    const currentData = await chrome.storage.local.get([key]);
                    const currentVal = (currentData && currentData[key] !== undefined) ? currentData[key] : value;
                    resolvedValue = (newValueOrUpdater as (prev: T) => T)(currentVal);
                } else {
                    resolvedValue = newValueOrUpdater;
                }

                setValue(resolvedValue);
                await chrome.storage.local.set({ [key]: resolvedValue });
            } catch (err) {
                Logger.error('useStorage', `Error updating storage for ${key}`, { err });
            }
        },
        [key, value]
    );

    return [value, updateValue, loading];
}

