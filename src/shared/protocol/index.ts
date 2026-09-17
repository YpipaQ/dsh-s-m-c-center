/**
 * The wire contract shared by the two halves of the plugin, in one import.
 *
 * Split by feature so a reader can jump straight to the shape they need
 * (`./skills`, `./mcp`, `./cli`, `./settings`) plus the route-path table
 * (`./api-paths`). This barrel exists so existing `from '../shared/protocol/index.ts'`
 * style imports keep working in one line; nothing here is more than a re-export.
 *
 * Types only — the browser half must not pull a Host value through it, with the
 * single exception of {@link SMC_API}, which is a plain frozen object of strings.
 * @module
 */

export type {
  ImportItem, LinkRecord, RegistryEntry, ScannedSkill, SkillDetail, SkillGroup,
  SkillLevel, SkillLinks, SkillSource, SkillSummary, SkillsRegistry, StoreEntry,
  StoreFailure, StoreIndex, StoreOperation, StoreStatus, VerifyResult,
} from './skills.ts'

export type {
  McpArchive, McpConnectionStatus, McpServerConfig, McpServerSummary, McpTransport,
} from './mcp.ts'

export type {
  CliRegistryEntry, CliSource, CliStateDetail, CliSubcommands, CliSummary, NormalizedCliEntry,
} from './cli.ts'

export type { ManagerSettings } from './settings.ts'

export { SMC_API, SMC_API_PREFIX } from './api-paths.ts'
