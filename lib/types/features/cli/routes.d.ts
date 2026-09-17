/**
 * The `/cli` route family.
 *
 * The read routes take their `name` from the query string; the mutations take
 * it from the JSON body. That asymmetry follows the client: `GET /cli?cwd=…`
 * lists, while every per-tool action is a POST carrying its target.
 * @module
 */
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { CliManager } from './manager.ts';
/** Build the CLI route table. */
export declare function cliRoutes(cli: CliManager): WebRoute[];
//# sourceMappingURL=routes.d.ts.map