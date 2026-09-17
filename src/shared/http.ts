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

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'

/** Requests may not exceed this much JSON (definitions and import lists are small). */
const MAX_BODY_BYTES = 1024 * 1024

/** Socket addresses a browser on this machine presents — and nothing else. */
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/** Hostnames a same-machine browser may use in its Host header. */
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** HTTP methods these routes answer. */
export type RouteMethod = 'GET' | 'POST'

/** What a route does once the shared fences have passed. */
export type RouteAction = (
  req: IncomingMessage,
  res: ServerResponse,
  body: Record<string, unknown>,
  url: URL,
) => Promise<void>

/** Parse a Host header into a URL; undefined when it is not one. */
function hostUrl(host: string): URL | undefined {
  try {
    return new URL('http://' + host)
  } catch {
    return undefined
  }
}

/**
 * Whether the request came from a browser on this machine.
 *
 * Three fences, cheapest first: the socket address (not forgeable by the
 * client), the Host header, and the browser's own same-origin markers, which
 * stop another origin from driving these routes via fetch.
 */
export function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress
  if (address === undefined || !LOOPBACK_ADDRESSES.has(address)) return false

  const host = request.headers.host
  if (typeof host !== 'string' || host === '') return false
  const target = hostUrl(host)
  if (target === undefined || !LOOPBACK_HOSTNAMES.has(target.hostname)) return false

  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true // same-origin fetches may omit it
  try {
    return new URL(origin).host === target.host
  } catch {
    return false
  }
}

/** Answer with JSON; no referrer ever travels back to the page. */
export function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'referrer-policy': 'no-referrer',
  })
  res.end(JSON.stringify(body))
}

/**
 * Read a JSON object body.
 * @returns the parsed object, or undefined when the body is oversized,
 *   malformed, or not an object — the caller answers 400 for all three.
 */
export async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = []
  let received = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    received += buffer.length
    if (received > MAX_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

/** A query parameter, or undefined when the route got none. */
export function queryParam(url: URL, name: string): string | undefined {
  return url.searchParams.get(name) ?? undefined
}

/** Message from an unknown thrown value. */
export function failure(e: unknown): string {
  return String((e as Error)?.message ?? e)
}

/** A string field off a request body; '' when absent or not a string. */
export function bodyText(body: Record<string, unknown>, key: string): string {
  const value = body?.[key]
  return typeof value === 'string' ? value : ''
}

/** A boolean field off a request body; true only when it is exactly `true`. */
export function bodyFlag(body: Record<string, unknown>, key: string): boolean {
  return body?.[key] === true
}

/** The success envelope every route answers with. */
export function ok(data: Record<string, unknown> = {}): Record<string, unknown> {
  return { ok: true, ...data }
}

/** Answer 400 with a message; the short form used across the route tables. */
export function badRequest(res: ServerResponse, error: string): void {
  writeJson(res, 400, { ok: false, error })
}

/** Answer 404 with a message. */
export function notFound(res: ServerResponse, error: string): void {
  writeJson(res, 404, { ok: false, error })
}

/**
 * Wrap one handler in the shared fences: loopback, method, JSON body, 500.
 *
 * Route tables are built by mapping over these, so the guards exist once and
 * every feature's routes inherit them by construction.
 */
export function handle(method: RouteMethod, path: string, act: RouteAction): WebRoute {
  return {
    kind: 'exact',
    path,
    handler: async (req, res) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' })
        return
      }
      if (req.method !== method) {
        writeJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      let payload: Record<string, unknown> = {}
      if (method === 'POST') {
        const parsed = await readJsonBody(req)
        if (parsed === undefined) {
          writeJson(res, 400, { ok: false, error: 'invalid or oversized JSON body' })
          return
        }
        payload = parsed
      }
      try {
        await act(req, res, payload, new URL(req.url ?? '/', 'http://localhost'))
      } catch (e) {
        writeJson(res, 500, { ok: false, error: failure(e) })
      }
    },
  }
}
