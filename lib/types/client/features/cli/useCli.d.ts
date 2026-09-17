import type { CliStateDetail, CliSubcommands, CliSummary } from '../../../shared/protocol/index.ts';
import type { Translate } from '../../shared/locales.ts';
/** Probe result for the currently expanded row. */
export interface CliDetailState {
    name: string;
    state?: CliStateDetail;
    subcommands?: CliSubcommands;
    busy: boolean;
    error: string;
}
export interface UseCliOptions {
    /** Workspace cwd passed to the Host (skill-embedded CLI discovery). */
    cwd: string;
    /** Bumped by the shell to force a refetch across tabs. */
    refreshKey: number;
    /** Shell-bound translator, so hook-generated messages are translated too. */
    t: Translate;
}
export interface UseCliResult {
    /** True only for the first fetch, when the list has nothing to show yet. */
    loading: boolean;
    /** True while any fetch is in flight, background refetches included. */
    refreshing: boolean;
    error: string;
    /** Filtered entries (query applied). */
    entries: CliSummary[];
    /** Entry count before filtering (drives the empty-state copy). */
    total: number;
    reload: () => void;
    query: string;
    setQuery: (v: string) => void;
    message: string;
    /** Expanded row probe state, or null when collapsed. */
    detail: CliDetailState | null;
    /** Expand (and probe) a row, or collapse it when already expanded. */
    view: (name: string) => void;
    toggle: (entry: CliSummary) => void;
    remove: (entry: CliSummary) => void;
    confirmName: string | null;
    /** New registry entry being typed. */
    form: {
        name: string;
        command: string;
    };
    setForm: (updater: (prev: {
        name: string;
        command: string;
    }) => {
        name: string;
        command: string;
    }) => void;
    addEntry: () => void;
}
/** CLI tab controller. */
export declare function useCli(options: UseCliOptions): UseCliResult;
//# sourceMappingURL=useCli.d.ts.map