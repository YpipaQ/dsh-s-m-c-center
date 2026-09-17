/**
 * The single owner of the HTTP client instance.
 *
 * Every data-access hook imports the client from here, so exactly one
 * SkillsMcpApi object exists per browser bundle (the old module created it in
 * the component file, which mixed transport concerns into the view layer).
 */
import { SkillsMcpApi } from './api.ts';
/** Stateless fetch client over the /api/dsh-s-m-c-center routes. */
export declare const api: SkillsMcpApi;
//# sourceMappingURL=useApi.d.ts.map