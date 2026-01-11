// Custom hook for offline sync status and manual sync trigger
import { useState, useEffect, useCallback } from 'react';
import { subscribeSyncStatus, performSync, SyncStatus } from '../lib/sync';
import { isOnline, onOnlineStatusChange } from '../lib/storage';

export interface UseOfflineSyncResult {
    isOnline: boolean;
    syncStatus: SyncStatus;
    manualSync: () => Promise<void>;
}

export function useOfflineSync(): UseOfflineSyncResult {
    const [online, setOnline] = useState(isOnline());
    const [syncStatus, setSyncStatus] = useState<SyncStatus>({
        isSyncing: false,
        lastSyncTime: null,
        pendingActions: 0,
        error: null,
    });

    useEffect(() => {
        // Subscribe to online/offline changes
        const unsubscribeOnline = onOnlineStatusChange(setOnline);

        // Subscribe to sync status changes
        const unsubscribeSync = subscribeSyncStatus(setSyncStatus);

        return () => {
            unsubscribeOnline();
            unsubscribeSync();
        };
    }, []);

    const manualSync = useCallback(async () => {
        await performSync();
    }, []);

    return {
        isOnline: online,
        syncStatus,
        manualSync,
    };
}
