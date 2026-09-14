import type { UseMcpResult } from '../hooks/useMcp.ts';
import type { UseSkillsResult } from '../hooks/useSkills.ts';
import type { Translate } from '../locales.ts';
export interface UninstallPanelProps {
    skills: UseSkillsResult;
    mcp: UseMcpResult;
    /** Bump the shell's refresh counter so the other tabs refetch. */
    refresh: () => void;
    t: Translate;
}
/** Uninstall prep tab. */
export declare function UninstallPanel({ skills, mcp, refresh, t }: UninstallPanelProps): import("react").JSX.Element;
//# sourceMappingURL=UninstallPanel.d.ts.map