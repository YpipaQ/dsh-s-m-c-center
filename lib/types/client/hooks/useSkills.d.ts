import type { ScannedSkill, SkillSummary, StoreStatus } from '../../protocol.ts';
import type { EnabledFilter } from '../utils/constants.ts';
import type { Translate } from '../locales.ts';
/** Scan/import sub-panel state. */
export interface ScanState {
    /** Directory being scanned (editable by the user). */
    dir: string;
    /** True while scanning or importing. */
    busy: boolean;
    /** Discovered candidates. */
    items: ScannedSkill[];
    /** sourcePath → checked. */
    selected: Record<string, boolean>;
    /** Failure message ('' when healthy). */
    error: string;
    /** Success/info note ('' when none). */
    note: string;
}
export interface UseSkillsOptions {
    /** Workspace cwd passed to the Host (project-scoped skill roots). */
    cwd: string;
    /** Bumped by the shell to force a refetch across tabs. */
    refreshKey: number;
    /** Directory picker exposed by the dsh shell. */
    pickDirectory: () => Promise<string | null>;
    /** Shell-bound translator, so hook-generated messages are translated too. */
    t: Translate;
}
export interface UseSkillsResult {
    /** Filtered + windowed list state. */
    loading: boolean;
    /** True while any list fetch is in flight, background refetches included. */
    refreshing: boolean;
    error: string;
    /** Rows after the query/enabled filters. */
    filtered: SkillSummary[];
    /** Filtered rows grouped by level, in display order. */
    groups: Array<{
        level: string;
        label: string;
        items: SkillSummary[];
    }>;
    /** Total rows before filtering (drives the empty copy). */
    total: number;
    /** User-level skills still living at their original location (not managed). */
    userUnmanaged: number;
    reload: () => void;
    query: string;
    setQuery: (v: string) => void;
    enabledFilter: EnabledFilter;
    setEnabledFilter: (v: EnabledFilter) => void;
    /** Path currently being mutated (spinner + disable). */
    busyPath: string;
    /** Transient action error. */
    message: string;
    toggle: (skill: SkillSummary) => void;
    /** Adopt an in-place skill into the store (import + enable, junction managed). */
    adoptOne: (skill: SkillSummary) => void;
    /** Two-step delete: first call arms the confirm, second executes. */
    remove: (skill: SkillSummary) => void;
    /** Path armed for deletion, or null. */
    confirmPath: string | null;
    detailPath: string | null;
    detail: {
        path: string;
        data: any;
    } | null;
    view: (skill: SkillSummary) => void;
    /** Store state for the migration banner, or null while loading. */
    store: StoreStatus | null;
    scan: ScanState;
    setScanDir: (dir: string) => void;
    chooseDir: () => void;
    doScan: () => void;
    toggleSelect: (sourcePath: string) => void;
    doImport: () => void;
}
/** Skills tab controller. */
export declare function useSkills(options: UseSkillsOptions): UseSkillsResult;
//# sourceMappingURL=useSkills.d.ts.map