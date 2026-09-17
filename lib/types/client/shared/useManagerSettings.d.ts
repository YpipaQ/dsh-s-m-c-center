import type { ManagerSettings } from '../../shared/protocol/index.ts';
/** Field-level state for the settings block. */
export interface ManagerSettingsState {
    /** True until the first read settles. */
    loading: boolean;
    /** Persisted record, or null before the first successful read. */
    value: ManagerSettings | null;
    /** Display-ready failure message ('' when healthy). */
    error: string;
    /** True while a save is in flight. */
    saving: boolean;
}
export interface UseManagerSettingsResult extends ManagerSettingsState {
    /** Flip announceToAgent and persist. No-op while loading/saving. */
    toggleAnnounce: () => void;
}
/** Read + persist the plugin's own settings block. */
export declare function useManagerSettings(): UseManagerSettingsResult;
//# sourceMappingURL=useManagerSettings.d.ts.map