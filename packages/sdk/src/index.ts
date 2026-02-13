/**
 * Keon SDK - TypeScript
 *
 * Safe-by-default client for Keon Runtime with governance-first execution.
 */

export { KeonClient } from './client';
export type { KeonClientConfig } from './client';

export { RetryPolicy } from './retry';
export type { RetryPolicyConfig } from './retry';

export type { RuntimeGateway } from './gateway';
export { HttpRuntimeGateway } from './http-gateway';
export type { HttpGatewayConfig } from './http-gateway';

export {
  KeonError,
  InvalidCorrelationIdError,
  MissingReceiptError,
  ExecutionDeniedError,
  ValidationError,
  NetworkError,
  ServerError,
  ClientError,
  TimeoutError,
} from './errors';

// Canonicalization (RFC 8785)
export {
  canonicalize,
  canonicalizeToString,
  canonicalizeBytes,
  validateIntegrity,
} from './canonicalize';

export const VERSION = '1.0.0';
