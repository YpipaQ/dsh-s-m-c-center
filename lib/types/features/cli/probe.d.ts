/**
 * Process probing: resolving a command, running it, reading a skill's probe.
 *
 * Kept apart from the manager because this is the only place that spawns
 * processes, which makes it the only place worth auditing for that. The rule it
 * enforces: `list()` never executes anything the user has not opted into — it
 * walks PATH, which is a stat per candidate directory — and only an explicit
 * state probe or subcommand request runs a binary.
 * @module
 */
import { toBool } from './registry.ts';
/** Whether we are on Windows, resolved once (junction/EXT/script choices). */
export declare const IS_WIN: boolean;
/** Walk PATH for an executable name without spawning it (portable, safe). */
export declare function resolveOnPath(command: string): string | undefined;
/** Run a command synchronously, capturing stdout/stderr. */
export declare function runSync(cmd: string, args: string[], timeoutMs?: number): {
    ok: boolean;
    out: string;
    err: string;
};
/**
 * Run a skill's `cli-state.*` probe script and parse its JSON document.
 *
 * A non-zero exit still gets a parse attempt: some probes exit non-zero with a
 * readable body, and the body is more useful than the exit code.
 */
export declare function runCliStateScript(scriptPath: string): {
    ok: boolean;
    data: Record<string, unknown> | null;
    error?: string;
};
/** Extract the wrapped CLI command name from a skill's run-cli script. */
export declare function cliCommandFromScript(scriptPath: string): string;
/**
 * Best-effort known install path for a tool installed outside PATH.
 *
 * `tencent-news-cli` installs to a per-user directory rather than PATH, so a
 * PATH walk alone would report it missing on a machine where it works.
 */
export declare function knownInstallPath(command: string): string | undefined;
/** Parse `Available Commands:` / `Commands:` block into a subcommand list. */
export declare function parseHelpCommands(help: string): string[];
/** Re-exported so the manager reads a probe boolean the same way the registry does. */
export { toBool };
//# sourceMappingURL=probe.d.ts.map