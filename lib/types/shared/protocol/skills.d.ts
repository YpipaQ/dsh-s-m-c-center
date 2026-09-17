/**
 * The skills half of the wire contract: rows, details, scan candidates, and
 * the three persisted ledgers (store manifest, registry, link ledger).
 * @module
 */
/** Which of the four roots a skill was found under. */
export type SkillSource = 'project-dsh' | 'project-agents' | 'user-dsh' | 'user-agents';
/** How the UI groups skills: by the workspace they belong to, or the user. */
export type SkillLevel = 'project' | 'user';
/**
 * Which of the four groups a row belongs to:
 * 1. `native` — a real file/directory in a scanned skill root;
 * 2. `stored` — the canonical copy lives in the store (`S-M-C/skills`);
 * 3. `registered` — an external skill whose copy stays where it was, recorded
 *    in `skills-registry.json`.
 * (Group 4 — the links themselves — is a property of the rows above: `linked`.)
 */
export type SkillGroup = 'native' | 'stored' | 'registered';
/** One row of the skills list. */
export interface SkillSummary {
    /** Skill name, from SKILL.md frontmatter. */
    name: string;
    /** One-line summary from frontmatter (dsh requires it). */
    description: string;
    /** Optional "when to use this" note ('' when frontmatter has none). */
    whenToUse: string;
    /** Which of the four groups this row belongs to. */
    group: SkillGroup;
    /** Whether a link to the canonical copy exists under `~/.dsh/skills`. */
    linked: boolean;
    /** True for a link on disk that the link ledger has no record of (red flag). */
    untracked?: boolean;
    /** The root it lives under, which also decides its level. */
    source: SkillSource;
    level: SkillLevel;
    /** A directory holding SKILL.md or DESCRIPTION.md, or a single flat `.md` file. */
    kind: 'bundle' | 'file';
    /** Absolute path of the admission document (SKILL.md / DESCRIPTION.md) or of the `.md` file. */
    path: string;
    /** Store / registry slug; present for stored and registered rows. */
    slug?: string;
}
/** One skill including its body, for the detail pane. */
export interface SkillDetail {
    name: string;
    description: string;
    whenToUse: string;
    /** Markdown body with the frontmatter block stripped. */
    content: string;
    path: string;
}
/** A skill candidate found by scanning a directory the user picked. */
export interface ScannedSkill {
    name: string;
    description: string;
    /** Where to register from: the bundle directory, or the `.md` file. */
    sourcePath: string;
    kind: 'bundle' | 'file';
    /** True when the candidate exceeds the 10 GB import cap. */
    oversize: boolean;
    /** On-disk size in bytes (best effort). */
    size: number;
}
/** One checked row of a scan, sent back to be registered. */
export interface ImportItem {
    sourcePath: string;
    kind: 'bundle' | 'file';
}
/**
 * One skill held in the store: the canonical copy lives under
 * `~/.dsh/S-M-C/skills/<slug>/`. `origin` records where it came from so a
 * migration can be undone. Link state lives in the link ledger — never in the
 * SKILL.md itself.
 */
export interface StoreEntry {
    /** Store directory name (unique within the store). */
    slug: string;
    /** Skill name from SKILL.md at adopt time. */
    name: string;
    /**
     * Where an unmigrate releases the skill: its pre-adoption path. Empty for
     * skills dropped straight into the store by an agent (no origin to restore).
     */
    origin: string;
    adoptedAt: string;
}
/** Persisted store manifest (`~/.dsh/S-M-C/skills/index.json`). */
export interface StoreIndex {
    version: 1;
    /** ISO timestamp of the one-shot migration, when it has run. */
    migratedAt?: string;
    entries: StoreEntry[];
    /** Skills the last migration could not move (left in place, still usable). */
    failures?: StoreFailure[];
}
/** One skill the migration could not move. */
export interface StoreFailure {
    path: string;
    reason: string;
}
/** Outcome of a migration or rollback run. */
export interface StoreOperation {
    /** Number of skills moved (or restored, for a rollback). */
    moved: number;
    failures: StoreFailure[];
}
/** Store state shown in the UI banner. */
export interface StoreStatus {
    /** The unified store root (e.g. `~/.dsh/S-M-C`), shown verbatim in the UI. */
    root: string;
    /** The skills directory inside it. */
    dir: string;
    migrated: boolean;
    migratedAt?: string;
    /** Skills currently held in the store. */
    count: number;
    /** Stored skills currently linked into `~/.dsh/skills`. */
    linked: number;
    /** Ledger records whose link no longer exists on disk. */
    untracked: number;
    failures: StoreFailure[];
}
/** One registered external/native skill (a row of `skills-registry.json`). */
export interface RegistryEntry {
    /** Registry slug (unique across registry + store). */
    slug: string;
    name: string;
    description: string;
    /** Canonical path: the bundle directory or the flat `.md` file. */
    path: string;
    kind: 'bundle' | 'file';
    /** `native` for skills found in a scanned root, `external` for imports. */
    origin: 'native' | 'external';
    registeredAt: string;
    /** Last successful existence check (the refresh button's traceability). */
    lastSeen?: string;
}
/** Persisted external-skills registry (`~/.dsh/S-M-C/skills-registry.json`). */
export interface SkillsRegistry {
    version: 1;
    entries: RegistryEntry[];
}
/** One ledger record for a link this plugin created. */
export interface LinkRecord {
    /** Skill slug the link serves. */
    slug: string;
    /** Absolute path of the link (always under `~/.dsh/skills`). */
    linkPath: string;
    /** Absolute path of the canonical copy the link points at. */
    targetPath: string;
    createdAt: string;
}
/** Persisted link ledger (`~/.dsh/S-M-C/skills-links.json`). */
export interface SkillLinks {
    version: 1;
    links: LinkRecord[];
}
/** Outcome of verifying one link. */
export interface VerifyResult {
    ok: boolean;
    reason?: string;
    /** Whether the link has a ledger record. */
    tracked?: boolean;
    /** Whether the target is a store copy. */
    stored?: boolean;
    target?: string;
    mdPath?: string;
}
//# sourceMappingURL=skills.d.ts.map