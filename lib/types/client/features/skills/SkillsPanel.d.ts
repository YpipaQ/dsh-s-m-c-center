import type { UseSkillsResult } from './useSkills.ts';
import type { UseContextsResult } from './useContexts.ts';
import type { Translate } from '../../shared/locales.ts';
export interface SkillsPanelProps {
    skills: UseSkillsResult;
    contexts: UseContextsResult;
    t: Translate;
}
/** Skills tab. */
export declare function SkillsPanel({ skills, contexts, t }: SkillsPanelProps): import("react").JSX.Element;
//# sourceMappingURL=SkillsPanel.d.ts.map