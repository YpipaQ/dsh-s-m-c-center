import type { UseCliResult } from '../hooks/useCli.ts';
import type { Translate } from '../locales.ts';
export interface CliPanelProps {
    cli: UseCliResult;
    t: Translate;
}
/** CLI tab. */
export declare function CliPanel({ cli, t }: CliPanelProps): import("react").JSX.Element;
//# sourceMappingURL=CliPanel.d.ts.map