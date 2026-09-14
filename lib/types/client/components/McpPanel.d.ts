import type { UseMcpResult } from '../hooks/useMcp.ts';
import type { Translate } from '../locales.ts';
export interface McpPanelProps {
    mcp: UseMcpResult;
    /** The unified store root, so the copy quotes the real path. */
    root?: string;
    t: Translate;
}
/** MCP tab. */
export declare function McpPanel({ mcp, root, t }: McpPanelProps): import("react").JSX.Element;
//# sourceMappingURL=McpPanel.d.ts.map