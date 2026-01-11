// Background sync logic and API communication layer
import {
    getPendingSyncActions,
    markSyncActionComplete,
    clearSyncedActions,
    SyncAction,
} from './db';
import { storage } from './storage';

// ============================================
// Sync Configuration
// ============================================

const API_BASE = '/api';
const SYNC_DEBOUNCE_MS = 2000;

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

// ============================================
// Sync Status Types
// ============================================

export interface SyncStatus {
    isSyncing: boolean;
    lastSyncTime: string | null;
    pendingActions: number;
    error: string | null;
}

type SyncStatusCallback = (status: SyncStatus) => void;
const statusCallbacks: Set<SyncStatusCallback> = new Set();

let currentStatus: SyncStatus = {
    isSyncing: false,
    lastSyncTime: null,
    pendingActions: 0,
    error: null,
};

function notifyStatusChange(status: Partial<SyncStatus>) {
    currentStatus = { ...currentStatus, ...status };
    statusCallbacks.forEach(cb => cb(currentStatus));
}

export function subscribeSyncStatus(callback: SyncStatusCallback): () => void {
    statusCallbacks.add(callback);
    callback(currentStatus);
    return () => statusCallbacks.delete(callback);
}

// ============================================
// Sync Operations
// ============================================

export async function triggerSync(): Promise<void> {
    // Debounce sync requests
    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }

    syncTimeout = setTimeout(async () => {
        await performSync();
    }, SYNC_DEBOUNCE_MS);
}

export async function performSync(): Promise<boolean> {
    if (isSyncing) {
        console.log('[Sync] Already syncing, skipping');
        return false;
    }

    if (!navigator.onLine) {
        console.log('[Sync] Offline, skipping');
        notifyStatusChange({ error: 'Offline - changes saved locally' });
        return false;
    }

    isSyncing = true;
    notifyStatusChange({ isSyncing: true, error: null });

    try {
        const pendingActions = await getPendingSyncActions();
        notifyStatusChange({ pendingActions: pendingActions.length });

        if (pendingActions.length === 0) {
            console.log('[Sync] No pending actions');
            notifyStatusChange({ isSyncing: false });
            isSyncing = false;
            return true;
        }

        console.log(`[Sync] Processing ${pendingActions.length} actions`);

        // Process each action
        for (const action of pendingActions) {
            try {
                await syncAction(action);
                await markSyncActionComplete(action.id!);
            } catch (error) {
                console.error(`[Sync] Failed to sync action ${action.id}:`, error);
                // Continue with other actions
            }
        }

        // Clean up synced actions
        await clearSyncedActions();

        const now = new Date().toISOString();
        await storage.setLastSyncTime(now);

        notifyStatusChange({
            isSyncing: false,
            lastSyncTime: now,
            pendingActions: 0,
        });

        console.log('[Sync] Completed successfully');
        return true;

    } catch (error) {
        console.error('[Sync] Error:', error);
        notifyStatusChange({
            isSyncing: false,
            error: error instanceof Error ? error.message : 'Sync failed',
        });
        return false;
    } finally {
        isSyncing = false;
    }
}

async function syncAction(action: SyncAction): Promise<void> {
    const endpoint = getEndpoint(action.entity, action.entityId);

    switch (action.type) {
        case 'create':
            await fetch(`${API_BASE}/${action.entity}s`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(action.data),
            });
            break;

        case 'update':
            await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(action.data),
            });
            break;

        case 'delete':
            await fetch(endpoint, {
                method: 'DELETE',
            });
            break;
    }
}

function getEndpoint(entity: string, id: string): string {
    return `${API_BASE}/${entity}s/${id}`;
}

// ============================================
// Pull from Server
// ============================================

export async function pullFromServer(): Promise<void> {
    if (!navigator.onLine) {
        console.log('[Sync] Offline, cannot pull');
        return;
    }

    try {
        notifyStatusChange({ isSyncing: true });

        // Fetch trips from server
        const response = await fetch(`${API_BASE}/trips`);
        if (!response.ok) {
            throw new Error('Failed to fetch trips');
        }

        const serverTrips = await response.json();
        console.log('[Sync] Pulled trips from server:', serverTrips);

        // TODO: Implement conflict resolution and merge logic

        notifyStatusChange({ isSyncing: false });
    } catch (error) {
        console.error('[Sync] Pull error:', error);
        notifyStatusChange({
            isSyncing: false,
            error: error instanceof Error ? error.message : 'Pull failed',
        });
    }
}

// ============================================
// Initialize Sync
// ============================================

export async function initializeSync(): Promise<void> {
    // Load last sync time
    const lastSyncTime = await storage.getLastSyncTime();
    notifyStatusChange({ lastSyncTime });

    // Count pending actions
    const pending = await getPendingSyncActions();
    notifyStatusChange({ pendingActions: pending.length });

    // Set up online listener
    window.addEventListener('online', () => {
        console.log('[Sync] Back online, triggering sync');
        triggerSync();
    });

    // Initial sync if online
    if (navigator.onLine && pending.length > 0) {
        triggerSync();
    }
}
