import type { UseSkillsResult } from '../hooks/useSkills.ts';
import type { UseContextsResult } from '../hooks/useContexts.ts';
import type { Translate } from '../locales.ts';
export interface SkillsPanelProps {
    skills: UseSkillsResult;
    contexts: UseContextsResult;
    t: Translate;
}
/** Skills tab. */
export declare function SkillsPanel({ skills, contexts, t }: SkillsPanelProps): import("react").JSX.Element;
//# sourceMappingURL=SkillsPanel.d.ts.map