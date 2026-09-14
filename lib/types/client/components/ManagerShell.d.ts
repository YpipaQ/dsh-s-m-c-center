import type { Translate } from '../locales.ts';
export interface ManagerShellProps {
    /** Workspace cwd passed to project-scoped Host routes. */
    cwd: string;
    /** Whether the plugin is enabled (routers/MCP/CLI probing active). */
    enabled: boolean;
    /** Directory picker supplied by the dsh shell. */
    pickDirectory: () => Promise<string | null>;
    /** Shell-bound translator for this plugin's namespace. */
    t: Translate;
}
/** Skills / MCP / CLI manager root. */
export declare function ManagerShell({ cwd, enabled, pickDirectory, t }: ManagerShellProps): import("react").JSX.Element;
//# sourceMappingURL=ManagerShell.d.ts.map