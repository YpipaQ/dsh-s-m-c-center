import type { SkillSummary } from '../../protocol.ts';
import type { Translate } from '../locales.ts';
export interface UseContextsOptions {
    cwd: string;
    /** Bumped by the shell to force a refetch. */
    refreshKey: number;
    /** The full skill list (rows to tick), shared with the skills tab. */
    skills: SkillSummary[];
    t: Translate;
}
export interface UseContextsResult {
    /** Conversations holding a selection, newest first (default excluded). */
    sessions: Array<{
        sessionId: string;
        count: number;
        updatedAt: string;
    }>;
    /** The session id the default selection lives under (dropdown's first row). */
    defaultId: string;
    /** The conversation whose checkboxes are shown, or null. */
    activeId: string | null;
    setActiveId: (id: string) => void;
    /** slug → selected for the active conversation. */
    checked: Record<string, boolean>;
    /** Rows the checkboxes map over (stored / registered rows carry a slug). */
    candidates: SkillSummary[];
    /** Row busy flag (slug currently being toggled). */
    busySlug: string;
    message: string;
    reload: () => void;
    toggle: (slug: string) => void;
}
export declare function useContexts(options: UseContextsOptions): UseContextsResult;
/** Session id the workspace default selection is stored under (host mirror). */
export declare const DEFAULT_CONTEXT_ID = "_default";
//# sourceMappingURL=useContexts.d.ts.map