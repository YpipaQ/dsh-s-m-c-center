import type { UseMcpResult } from '../hooks/useMcp.ts';
import type { Translate } from '../locales.ts';
export interface McpPanelProps {
    mcp: UseMcpResult;
    t: Translate;
}
/** MCP tab. */
export declare function McpPanel({ mcp, t }: McpPanelProps): import("react").JSX.Element;
//# sourceMappingURL=McpPanel.d.ts.map