/**
 * Keon SDK Error Types
 *
 * Typed exceptions for structured error handling.
 */

import type { CorrelationId } from '@keon/contracts';

/**
 * Base error for all Keon SDK errors
 */
export class KeonError extends Error {
  public readonly correlationId?: CorrelationId;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'KEON_ERROR',
    correlationId?: CorrelationId,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'KeonError';
    this.code = code;
    this.correlationId = correlationId;
    this.details = details;
    Object.setPrototypeOf(this, KeonError.prototype);
  }
}

/**
 * Invalid CorrelationId format
 */
export class InvalidCorrelationIdError extends KeonError {
  constructor(correlationId: string, details?: Record<string, unknown>) {
    super(
      `Invalid CorrelationId format. Expected: t:<TenantId>|c:<uuidv7>, got: ${correlationId}`,
      'INVALID_CORRELATION_ID',
      undefined,
      details
    );
    this.name = 'InvalidCorrelationIdError';
    Object.setPrototypeOf(this, InvalidCorrelationIdError.prototype);
  }
}

/**
 * Missing decision receipt when executing
 */
export class MissingReceiptError extends KeonError {
  constructor(correlationId?: CorrelationId, details?: Record<string, unknown>) {
    super(
      'Execute requires a valid DecisionReceiptId. Call decide() first.',
      'MISSING_RECEIPT',
      correlationId,
      details
    );
    this.name = 'MissingReceiptError';
    Object.setPrototypeOf(this, MissingReceiptError.prototype);
  }
}

/**
 * Execution denied by policy
 */
export class ExecutionDeniedError extends KeonError {
  constructor(
    reason: string,
    correlationId?: CorrelationId,
    details?: Record<string, unknown>
  ) {
    super(
      `Execution denied: ${reason}`,
      'EXECUTION_DENIED',
      correlationId,
      details
    );
    this.name = 'ExecutionDeniedError';
    Object.setPrototypeOf(this, ExecutionDeniedError.prototype);
  }
}

/**
 * Request validation failed
 */
export class ValidationError extends KeonError {
  constructor(
    message: string,
    correlationId?: CorrelationId,
    details?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', correlationId, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Network/connectivity errors
 */
export class NetworkError extends KeonError {
  constructor(
    message: string,
    correlationId?: CorrelationId,
    details?: Record<string, unknown>
  ) {
    super(message, 'NETWORK_ERROR', correlationId, details);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Server errors (5xx)
 */
export class ServerError extends KeonError {
  public readonly statusCode: number;

  constructor(
    message: string,
    statusCode: number,
    correlationId?: CorrelationId,
    details?: Record<string, unknown>
  ) {
    super(message, 'SERVER_ERROR', correlationId, details);
    this.name = 'ServerError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/**
 * Client errors (4xx)
 */
export class ClientError extends KeonError {
  public readonly statusCode: number;

  constructor(
    message: string,
    statusCode: number,
    correlationId?: CorrelationId,
    details?: Record<string, unknown>
  ) {
    super(message, 'CLIENT_ERROR', correlationId, details);
    this.name = 'ClientError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ClientError.prototype);
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends NetworkError {
  constructor(correlationId?: CorrelationId, details?: Record<string, unknown>) {
    super('Request timed out', correlationId, details);
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT_ERROR';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}
