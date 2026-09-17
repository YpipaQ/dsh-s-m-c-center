/**
 * Public surface of the CLI feature.
 * @module
 */

export { CliManager } from './manager.ts'
export { cliRoutes } from './routes.ts'
export { cliConfigPath, normalizeCliEntry, readCliConfig, writeCliConfig } from './registry.ts'
