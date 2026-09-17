/**
 * Numeric caps and directory names the skills feature works within.
 *
 * They live in one file because they are the feature's contract with the user
 * (what gets imported, how deep a scan goes, where the legacy store was) rather
 * than an implementation detail of any single module.
 * @module
 */

/** Cap for one imported skill's on-disk size. */
export const MAX_SKILL_BYTES = 10 * 1024 * 1024 * 1024

/** How deep {@link scanSkills} descends below the picked root. */
export const SCAN_DEPTH = 2

/**
 * Directory name of the legacy store, kept only so the store-root migration
 * can recognise an old layout and move it.
 */
export const STORE_DIR_NAME = 'skills-store'
