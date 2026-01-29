/**
 * Keon Runtime API Contracts - TypeScript
 *
 * Generated from OpenAPI specification.
 * Source: keon-contracts/contracts/openapi/keon.runtime.v1.yaml
 *
 * Core principles:
 * - Law before execution
 * - Execute requires DecisionReceiptId (hard fail if absent)
 * - CorrelationId is mandatory in canonical form: t:<TenantId>|c:<uuidv7>
 * - All responses use KeonResult<T> envelope
 */

/**
 * CorrelationId canonical format: t:<TenantId>|c:<uuidv7>
 * Example: "t:tenant-123|c:01932b3c-4d5e-7890-abcd-ef1234567890"
 */
export type CorrelationId = string;

/**
 * Decision outcome: allow or deny
 */
export type DecisionOutcome = 'allow' | 'deny';

/**
 * DecideRequest - Request a policy decision
 */
export interface DecideRequest {
  /** CorrelationId in canonical format: t:<TenantId>|c:<uuidv7> */
  correlationId: CorrelationId;
  /** Tenant identifier */
  tenantId: string;
  /** Actor identifier (user, service, agent) */
  actorId: string;
  /** Action being requested */
  action: string;
  /** Type of resource */
  resourceType: string;
  /** Resource identifier */
  resourceId: string;
  /** Optional additional context */
  context?: Record<string, unknown>;
}

/**
 * DecisionReceipt - Result of a policy decision
 */
export interface DecisionReceipt {
  /** Receipt identifier (required for execute) */
  receiptId: string;
  /** Decision outcome */
  decision: DecisionOutcome;
  /** CorrelationId from request */
  correlationId: CorrelationId;
  /** Tenant identifier */
  tenantId: string;
  /** Actor identifier */
  actorId: string;
  /** ISO 8601 timestamp when decision was made */
  decidedAt: string;
  /** ISO 8601 timestamp when receipt expires (optional) */
  expiresAt?: string;
  /** Human-readable reason for decision */
  reason: string;
  /** List of applied policy IDs */
  appliedPolicies: string[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * DecideResponse - Wrapper for DecisionReceipt
 */
export interface DecideResponse {
  success: true;
  data: DecisionReceipt;
}

/**
 * ExecuteRequest - Execute an action with a decision receipt
 */
export interface ExecuteRequest {
  /** Decision receipt ID (REQUIRED - hard fail if absent) */
  decisionReceiptId: string;
  /** CorrelationId in canonical format */
  correlationId: CorrelationId;
  /** Action to execute (must match decision) */
  action: string;
  /** Execution parameters */
  parameters: Record<string, unknown>;
}

/**
 * ExecutionResult - Result of execution
 */
export interface ExecutionResult {
  /** Execution identifier */
  executionId: string;
  /** CorrelationId from request */
  correlationId: CorrelationId;
  /** Status: success, failure, partial */
  status: 'success' | 'failure' | 'partial';
  /** ISO 8601 timestamp when execution completed */
  executedAt: string;
  /** Execution output/result */
  result: unknown;
  /** Optional error details if status is failure */
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * ExecuteResponse - Wrapper for ExecutionResult
 */
export interface ExecuteResponse {
  success: true;
  data: ExecutionResult;
}

/**
 * ErrorResponse - Error envelope
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    correlationId?: CorrelationId;
    details?: Record<string, unknown>;
  };
}

/**
 * KeonResult<T> - Generic result envelope
 */
export type KeonResult<T> =
  | { success: true; data: T }
  | ErrorResponse;

/**
 * Type guards
 */
export function isSuccess<T>(result: KeonResult<T>): result is { success: true; data: T } {
  return result.success === true;
}

export function isError<T>(result: KeonResult<T>): result is ErrorResponse {
  return result.success === false;
}

/**
 * Validation helpers
 */
const CORRELATION_ID_PATTERN = /^t:[^|]+\|c:[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidCorrelationId(correlationId: string): boolean {
  return CORRELATION_ID_PATTERN.test(correlationId);
}

export function validateCorrelationId(correlationId: string): void {
  if (!isValidCorrelationId(correlationId)) {
    throw new Error(
      `Invalid CorrelationId format. Expected: t:<TenantId>|c:<uuidv7>, got: ${correlationId}`
    );
  }
}

/**
 * Extract tenant ID from CorrelationId
 */
export function extractTenantId(correlationId: CorrelationId): string {
  const match = correlationId.match(/^t:([^|]+)\|c:/);
  if (!match) {
    throw new Error(`Cannot extract tenant ID from CorrelationId: ${correlationId}`);
  }
  return match[1];
}
