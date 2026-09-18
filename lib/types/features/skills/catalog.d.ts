/**
 * The catalog index skill — our one line in the model's skill catalog.
 *
 * dsh publishes a skill catalog before every step: one ``- `name`: description``
 * line for each model-invocable skill in the conversation's scope. It is built
 * from whatever the skill roots hold plus whatever the conversation's own layer
 * registers, so it grows with the machine and never with the conversation — a
 * skill that is stored but not linked is simply absent, and the model has no way
 * to ask what exists.
 *
 * This module adds exactly one entry: a pointer whose *body* carries the
 * complete list in that same shape. The catalog's standing cost stays at one
 * line, and the full list is paid for only when the model loads it.
 *
 * It rides along with every apply (see `publishSet` in the context engine), so
 * it is in the catalog whether or not anything has been selected.
 * @module
 */
import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
import type { SkillSummary } from '../../shared/protocol/index.ts';
/** Name of the index skill in the catalog (also usable as `/smc-skill-index`). */
export declare const INDEX_NAME = "smc-skill-index";
/**
 * The index skill for one conversation.
 *
 * @param rows - every skill the manager knows (linked or not, selected or not).
 * @param selected - the slugs enabled in this conversation.
 */
export declare function buildIndexSkill(rows: SkillSummary[], selected: string[]): SkillRegistration;
//# sourceMappingURL=catalog.d.ts.map