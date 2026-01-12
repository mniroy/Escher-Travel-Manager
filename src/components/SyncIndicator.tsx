// Visual indicator for sync status, offline mode, and sync errors
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { motion, AnimatePresence } from 'framer-motion';

export function SyncIndicator() {
    const { isOnline, syncStatus, manualSync } = useOfflineSync();

    const getStatusContent = () => {
        if (!isOnline) {
            return {
                icon: <CloudOff size={14} />,
                text: 'Offline',
                color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            };
        }

        if (syncStatus.isSyncing) {
            return {
                icon: <RefreshCw size={14} className="animate-spin" />,
                text: 'Syncing...',
                color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            };
        }

        if (syncStatus.error) {
            return {
                icon: <AlertCircle size={14} />,
                text: 'Sync error',
                color: 'bg-red-500/20 text-red-400 border-red-500/30',
            };
        }

        if (syncStatus.pendingActions > 0) {
            return {
                icon: <Cloud size={14} />,
                text: `${syncStatus.pendingActions} pending`,
                color: 'bg-zinc-800 text-zinc-400 border-zinc-700',
            };
        }

        return {
            icon: <Check size={14} />,
            text: 'Synced',
            color: 'bg-green-500/20 text-green-400 border-green-500/30',
        };
    };

    const status = getStatusContent();

    // Hide "Synced" badge as requested
    if (status.text === 'Synced') {
        return null;
    }

    return (
        <AnimatePresence mode="wait">
            <motion.button
                key={status.text}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                onClick={() => isOnline && manualSync()}
                disabled={!isOnline || syncStatus.isSyncing}
                className={`
                    flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold
                    border transition-all cursor-pointer
                    hover:scale-105 active:scale-95
                    disabled:cursor-not-allowed disabled:hover:scale-100
                    ${status.color}
                `}
                title={
                    syncStatus.lastSyncTime
                        ? `Last synced: ${new Date(syncStatus.lastSyncTime).toLocaleTimeString()}`
                        : 'Click to sync'
                }
            >
                {status.icon}
                <span className="uppercase tracking-wider">{status.text}</span>
            </motion.button>
        </AnimatePresence>
    );
}
