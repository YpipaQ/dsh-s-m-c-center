import type { SkillSummary } from '../../../shared/protocol/index.ts';
import type { Translate } from '../../shared/locales.ts';
export interface UseContextsOptions {
    /** Bumped by the shell to force a refetch. */
    refreshKey: number;
    /** The full skill list (rows to tick), shared with the skills tab. */
    skills: SkillSummary[];
    t: Translate;
}
export interface UseContextsResult {
    /** slug → ticked, for the session default. */
    checked: Record<string, boolean>;
    /** How many the default has ticked (the section counter). */
    defaultCount: number;
    /** Rows the switches map over (stored / registered rows carry a slug). */
    candidates: SkillSummary[];
    /** Row busy flag (slug currently being toggled). */
    busySlug: string;
    message: string;
    /** Where the state lives — shown in the card so it is findable. */
    tablePath: string;
    reload: () => void;
    toggle: (slug: string) => void;
}
/** Session id the session default lives under (host mirror). */
export declare const DEFAULT_CONTEXT_ID = "_default";
export declare function useContexts(options: UseContextsOptions): UseContextsResult;
//# sourceMappingURL=useContexts.d.ts.map