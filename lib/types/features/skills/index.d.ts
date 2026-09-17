/**
 * Public surface of the skills feature.
 *
 * The rest of the plugin imports from here — never from the individual
 * modules — so the internal split (roots / ledgers / linking / adoption /
 * scanning / deletion / migration) stays free to change.
 * @module
 */
export { SkillsManager } from './manager.ts';
export { skillsRoutes } from './routes.ts';
export { STORE_DIR_NAME, MAX_SKILL_BYTES, SCAN_DEPTH } from './limits.ts';
export { findProjectRoot, getRoots, inside, isLink, entryKind, levelOf, scanTargets } from './roots.ts';
export type { SkillRoots } from './roots.ts';
//# sourceMappingURL=index.d.ts.map