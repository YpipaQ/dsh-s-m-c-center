/**
 * The HTTP trust fence and request plumbing every route family shares.
 *
 * These routes read and write user files and spawn MCP servers, so a
 * LAN-exposed dsh web deployment must not serve them. The fence has three
 * layers, cheapest first: the socket address (not forgeable by the client),
 * the Host header, and the browser's own same-origin markers.
 *
 * `handle()` wraps one handler in loopback + method + JSON-body checks and a
 * 500 fallback, so a feature's route table reads as a list of actions rather
 * than a list of guards.
 * @module
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
/** HTTP methods these routes answer. */
export type RouteMethod = 'GET' | 'POST';
/** What a route does once the shared fences have passed. */
export type RouteAction = (req: IncomingMessage, res: ServerResponse, body: Record<string, unknown>, url: URL) => Promise<void>;
/**
 * Whether the request came from a browser on this machine.
 *
 * Three fences, cheapest first: the socket address (not forgeable by the
 * client), the Host header, and the browser's own same-origin markers, which
 * stop another origin from driving these routes via fetch.
 */
export declare function isLoopbackRequest(request: IncomingMessage): boolean;
/** Answer with JSON; no referrer ever travels back to the page. */
export declare function writeJson(res: ServerResponse, status: number, body: unknown): void;
/**
 * Read a JSON object body.
 * @returns the parsed object, or undefined when the body is oversized,
 *   malformed, or not an object — the caller answers 400 for all three.
 */
export declare function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | undefined>;
/** A query parameter, or undefined when the route got none. */
export declare function queryParam(url: URL, name: string): string | undefined;
/** Message from an unknown thrown value. */
export declare function failure(e: unknown): string;
/** A string field off a request body; '' when absent or not a string. */
export declare function bodyText(body: Record<string, unknown>, key: string): string;
/** A boolean field off a request body; true only when it is exactly `true`. */
export declare function bodyFlag(body: Record<string, unknown>, key: string): boolean;
/** The success envelope every route answers with. */
export declare function ok(data?: Record<string, unknown>): Record<string, unknown>;
/** Answer 400 with a message; the short form used across the route tables. */
export declare function badRequest(res: ServerResponse, error: string): void;
/** Answer 404 with a message. */
export declare function notFound(res: ServerResponse, error: string): void;
/**
 * Wrap one handler in the shared fences: loopback, method, JSON body, 500.
 *
 * Route tables are built by mapping over these, so the guards exist once and
 * every feature's routes inherit them by construction.
 */
export declare function handle(method: RouteMethod, path: string, act: RouteAction): WebRoute;
//# sourceMappingURL=http.d.ts.map