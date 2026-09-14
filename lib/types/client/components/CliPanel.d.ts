import type { UseCliResult } from '../hooks/useCli.ts';
import type { Translate } from '../locales.ts';
export interface CliPanelProps {
    cli: UseCliResult;
    /** The unified store root, so the copy quotes the real registry path. */
    root?: string;
    t: Translate;
}
/** CLI tab. */
export declare function CliPanel({ cli, root, t }: CliPanelProps): import("react").JSX.Element;
//# sourceMappingURL=CliPanel.d.ts.map