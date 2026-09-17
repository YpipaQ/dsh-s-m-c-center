import type { ScannedSkill, SkillSummary, StoreStatus } from '../../../shared/protocol/index.ts';
import type { Translate } from '../../shared/locales.ts';
/** Scan/register sub-panel state. */
export interface ScanState {
    /** Directory being scanned (editable by the user). */
    dir: string;
    /** True while scanning or registering. */
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
    /** Rows after the name filter. */
    filtered: SkillSummary[];
    /** Filtered rows grouped by level, in display order. */
    groups: Array<{
        level: string;
        label: string;
        items: SkillSummary[];
    }>;
    /** Total rows before filtering (drives the empty copy). */
    total: number;
    /** User-level native skills still at their original location. */
    userUnmanaged: number;
    reload: () => void;
    query: string;
    setQuery: (v: string) => void;
    /** Path currently being mutated (spinner + disable). */
    busyPath: string;
    /** Transient action error. */
    message: string;
    /** Create (or confirm) the link for a stored/registered skill. */
    link: (skill: SkillSummary) => void;
    /** Remove the link (the canonical copy is never touched). */
    unlink: (skill: SkillSummary) => void;
    /** Native → stored: canonical copy into the store, link back in place. */
    migrate: (skill: SkillSummary) => void;
    /** Drop a registry entry (and its link, when one exists). */
    unregister: (skill: SkillSummary) => void;
    /** Verify one link; the result lands in `message`. */
    verify: (skill: SkillSummary) => void;
    /** Delete an untracked link (one the ledger has no record of). */
    deleteUntracked: (skill: SkillSummary) => void;
    /** Traceability pass over the registry; the summary lands in `message`. */
    refreshRegistry: () => void;
    /** Delete a stored skill (the shared confirm button owns the arming). */
    remove: (skill: SkillSummary) => void;
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
    doRegister: () => void;
}
/** Skills tab controller. */
export declare function useSkills(options: UseSkillsOptions): UseSkillsResult;
//# sourceMappingURL=useSkills.d.ts.map