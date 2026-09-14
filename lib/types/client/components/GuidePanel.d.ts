import type { UseMcpResult } from '../hooks/useMcp.ts';
import type { UseSkillsResult } from '../hooks/useSkills.ts';
import type { Translate } from '../locales.ts';
export interface GuidePanelProps {
    skills: UseSkillsResult;
    mcp: UseMcpResult;
    /** Bump the shell's refresh counter so the other tabs refetch. */
    refresh: () => void;
    t: Translate;
}
/** Guide tab. */
export declare function GuidePanel({ skills, mcp, refresh, t }: GuidePanelProps): import("react").JSX.Element;
//# sourceMappingURL=GuidePanel.d.ts.map