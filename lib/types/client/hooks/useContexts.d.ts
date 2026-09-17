import type { SkillSummary } from '../../protocol.ts';
import type { SkillsMcpKey, Translate } from '../locales.ts';
export interface UseContextsOptions {
    cwd: string;
    /** Bumped by the shell to force a refetch. */
    refreshKey: number;
    /** The full skill list (rows to tick), shared with the skills tab. */
    skills: SkillSummary[];
    t: Translate;
}
export interface UseContextsResult {
    /** Conversations holding a selection, newest first. */
    sessions: Array<{
        sessionId: string;
        count: number;
        updatedAt: string;
    }>;
    /** The conversation whose checkboxes are shown, or null. */
    activeId: string | null;
    setActiveId: (id: string) => void;
    /** slug → selected for the active conversation. */
    checked: Record<string, boolean>;
    /** Rows the checkboxes map over (user-level stored/registered/native). */
    candidates: SkillSummary[];
    /** Row busy flag (slug currently being toggled). */
    busySlug: string;
    message: string;
    reload: () => void;
    toggle: (slug: string) => void;
}
export declare function useContexts(options: UseContextsOptions): UseContextsResult;
/** Shared export so the panel can render the empty copy with the right key. */
export declare function contextEmptyKey(): SkillsMcpKey;
//# sourceMappingURL=useContexts.d.ts.map