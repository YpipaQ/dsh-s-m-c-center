import type { McpServerSummary } from '../../protocol.ts';
import { type McpForm } from '../utils/constants.ts';
import type { Translate } from '../locales.ts';
export interface UseMcpOptions {
    /** Bumped by the shell to force a refetch across tabs. */
    refreshKey: number;
    /** Shell-bound translator, so hook-generated messages are translated too. */
    t: Translate;
}
export interface UseMcpResult {
    /** True only for the first fetch, when the list has nothing to show yet. */
    loading: boolean;
    /** True while any fetch is in flight, background refetches included. */
    refreshing: boolean;
    error: string;
    /** Filtered servers (query applied). */
    servers: McpServerSummary[];
    /** Server count before filtering (drives the empty-state copy). */
    total: number;
    reload: () => void;
    /** Server-name search box. */
    query: string;
    setQuery: (v: string) => void;
    /** Transient action message (success or failure). */
    message: string;
    /** Editor state. */
    form: McpForm;
    patchForm: (p: Partial<McpForm>) => void;
    /** '' | 'save' | 'test' while an action is in flight. */
    busy: string;
    save: () => void;
    test: () => void;
    toggle: (s: McpServerSummary) => void;
    remove: (s: McpServerSummary) => void;
    edit: (s: McpServerSummary) => void;
    /** Name armed for deletion, or null. */
    confirmName: string | null;
}
/** MCP tab controller. */
export declare function useMcp(options: UseMcpOptions): UseMcpResult;
//# sourceMappingURL=useMcp.d.ts.map