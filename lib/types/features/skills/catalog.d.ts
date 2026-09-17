/**
 * The catalog hijack.
 *
 * dsh publishes a skill catalog before every step: one
 * ``- `name`: description`` line for each model-invocable skill in the
 * conversation's scope. It is the model's only index of what exists, and it is
 * built from whatever is linked into the skill roots — so it grows with the
 * machine, never with the conversation, and it cannot list a skill that is
 * stored but not linked.
 *
 * The plugin already overrides those lines: a registration inside the
 * conversation's own layer wins over the filesystem entry of the same name, so
 * whatever we register is what the model reads. This module uses that to add
 * exactly one line — an index skill — whose body carries the *complete* list in
 * the very same shape. The catalog's standing cost stays at one line, and the
 * full list is paid for only when someone actually asks for it.
 * @module
 */
import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
import type { SkillSummary } from '../../shared/protocol/index.ts';
/** Name of the index skill in the catalog (also usable as `/smc-skill-index`). */
export declare const INDEX_NAME = "smc-skill-index";
/**
 * The index skill for one conversation.
 *
 * @param rows - every skill the manager knows (linked or not, enabled or not).
 * @param selected - the slugs enabled in this conversation.
 */
export declare function buildIndexSkill(rows: SkillSummary[], selected: string[]): SkillRegistration;
//# sourceMappingURL=catalog.d.ts.map