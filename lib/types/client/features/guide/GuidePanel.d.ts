import type { UseMcpResult } from '../mcp/useMcp.ts';
import type { UseSkillsResult } from '../skills/useSkills.ts';
import type { Translate } from '../../shared/locales.ts';
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