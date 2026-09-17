/**
 * The `/skills` route family.
 *
 * Every handler here is thin: validate the body, call one manager method,
 * answer. The fences (loopback, method, JSON body, 500) come from
 * `handle()` in the shared http layer, so what is left is the actual contract —
 * which field is required and which shape comes back.
 * @module
 */
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { SkillsManager } from './manager.ts';
/** Build the skills route table. */
export declare function skillsRoutes(skills: SkillsManager): WebRoute[];
//# sourceMappingURL=routes.d.ts.map