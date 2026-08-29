/**
 * Shared API contracts — the normalized shapes the frontend consumes, mirroring
 * the NestJS backend adapters. Single source of truth for these types; runtime
 * helpers (label maps, formatters, fetch functions) live in `@/lib/*`.
 */
export * from './ruptela';
export * from './novaposhta';
