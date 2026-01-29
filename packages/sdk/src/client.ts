/**
 * Keon SDK Client
 *
 * Main entry point for interacting with Keon Runtime.
 */

import type {
  CorrelationId,
  DecisionReceipt,
  ExecutionResult,
} from '@keon/contracts';
import {
  validateCorrelationId,
  extractTenantId,
} from '@keon/contracts';
import type { RuntimeGateway } from './gateway';
import { HttpRuntimeGateway } from './http-gateway';
import { RetryPolicy } from './retry';
import {
  ExecutionDeniedError,
  InvalidCorrelationIdError,
  MissingReceiptError,
} from './errors';

/**
 * Generate UUIDv7
 *
 * Note: This is a simplified implementation.
 * In production, use a proper UUIDv7 library.
 */
function generateUuidv7(): string {
  const timestamp = Date.now();
  const randomBytes = crypto.getRandomValues(new Uint8Array(10));

  const timestampHex = timestamp.toString(16).padStart(12, '0');
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return [
    timestampHex.slice(0, 8),
    timestampHex.slice(8, 12),
    '7' + randomHex.slice(0, 3),
    ((parseInt(randomHex.slice(3, 5), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + randomHex.slice(5, 7),
    randomHex.slice(7, 19),
  ].join('-');
}

export interface KeonClientConfig {
  baseUrl?: string;
  apiKey?: string;
  bearerToken?: string;
  retryPolicy?: RetryPolicy;
  timeout?: number;
  gateway?: RuntimeGateway;
}

/**
 * Keon TypeScript SDK Client
 *
 * Safe-by-default client for Keon Runtime with:
 * - Strict validation (CorrelationId, receipt requirements)
 * - Automatic retries for transient failures
 * - Structured error handling
 *
 * Example:
 * ```typescript
 * import { KeonClient } from '@keon/sdk';
 *
 * const client = new KeonClient({
 *   baseUrl: 'https://api.keon.systems/runtime/v1',
 *   apiKey: 'your-api-key',
 * });
 *
 * // Decide
 * const receipt = await client.decide({
 *   tenantId: 'tenant-123',
 *   actorId: 'user-456',
 *   action: 'execute_workflow',
 *   resourceType: 'workflow',
 *   resourceId: 'workflow-789',
 * });
 *
 * // Execute (requires receipt)
 * if (receipt.decision === 'allow') {
 *   const result = await client.execute({
 *     receipt,
 *     action: 'execute_workflow',
 *     parameters: { workflowId: 'workflow-789' },
 *   });
 * }
 * ```
 */
export class KeonClient {
  private readonly gateway: RuntimeGateway;

  constructor(config: KeonClientConfig = {}) {
    const {
      baseUrl = 'http://localhost:8080/runtime/v1',
      apiKey,
      bearerToken,
      retryPolicy = RetryPolicy.default(),
      timeout = 30000,
      gateway,
    } = config;

    if (gateway) {
      this.gateway = gateway;
    } else {
      this.gateway = new HttpRuntimeGateway({
        baseUrl,
        apiKey,
        bearerToken,
        timeout,
        retryPolicy,
      });
    }
  }

  /**
   * Request a policy decision
   *
   * @param params - Decision request parameters
   * @returns DecisionReceipt with decision (allow/deny) and receiptId
   * @throws InvalidCorrelationIdError - CorrelationId format invalid
   * @throws ValidationError - Request validation failed
   * @throws NetworkError - Connection/timeout issues
   * @throws ServerError - 5xx server errors
   * @throws KeonError - Other errors
   *
   * @example
   * ```typescript
   * const receipt = await client.decide({
   *   tenantId: 'tenant-123',
   *   actorId: 'user-456',
   *   action: 'execute_workflow',
   *   resourceType: 'workflow',
   *   resourceId: 'workflow-789',
   *   context: { environment: 'production' },
   * });
   * ```
   */
  async decide(params: {
    tenantId: string;
    actorId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    context?: Record<string, unknown>;
    correlationId?: CorrelationId;
  }): Promise<DecisionReceipt> {
    const correlationId =
      params.correlationId ||
      this.generateCorrelationId(params.tenantId);

    try {
      validateCorrelationId(correlationId);
    } catch (error) {
      throw new InvalidCorrelationIdError(correlationId);
    }

    const response = await this.gateway.decide({
      correlationId,
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      context: params.context,
    });

    return response.data;
  }

  /**
   * Execute an action with a decision receipt
   *
   * REQUIRES: Valid DecisionReceipt from decide()
   * HARD FAIL: If receiptId is missing or invalid
   *
   * @param params - Execution request parameters
   * @returns ExecutionResult with status and result
   * @throws MissingReceiptError - Receipt is missing or invalid
   * @throws ExecutionDeniedError - Receipt has decision=deny
   * @throws InvalidCorrelationIdError - CorrelationId format invalid
   * @throws ValidationError - Request validation failed
   * @throws NetworkError - Connection/timeout issues
   * @throws ServerError - 5xx server errors
   * @throws KeonError - Other errors
   *
   * @example
   * ```typescript
   * const result = await client.execute({
   *   receipt,
   *   action: 'execute_workflow',
   *   parameters: { workflowId: 'workflow-789' },
   * });
   * ```
   */
  async execute(params: {
    receipt: DecisionReceipt;
    action: string;
    parameters: Record<string, unknown>;
    correlationId?: CorrelationId;
  }): Promise<ExecutionResult> {
    const { receipt, action, parameters } = params;

    if (!receipt || !receipt.receiptId) {
      throw new MissingReceiptError(params.correlationId);
    }

    if (receipt.decision === 'deny') {
      throw new ExecutionDeniedError(
        receipt.reason,
        receipt.correlationId,
        { appliedPolicies: receipt.appliedPolicies }
      );
    }

    const correlationId = params.correlationId || receipt.correlationId;

    try {
      validateCorrelationId(correlationId);
    } catch (error) {
      throw new InvalidCorrelationIdError(correlationId);
    }

    const response = await this.gateway.execute({
      decisionReceiptId: receipt.receiptId,
      correlationId,
      action,
      parameters,
    });

    return response.data;
  }

  /**
   * Decide and execute in one call (convenience method)
   *
   * Automatically handles:
   * - Decision request
   * - Receipt validation
   * - Execution (if allowed)
   * - Error handling (if denied)
   *
   * @param params - Combined decision + execution parameters
   * @returns ExecutionResult if allowed
   * @throws ExecutionDeniedError - Decision was deny
   * @throws InvalidCorrelationIdError - CorrelationId format invalid
   * @throws ValidationError - Request validation failed
   * @throws NetworkError - Connection/timeout issues
   * @throws ServerError - 5xx server errors
   * @throws KeonError - Other errors
   *
   * @example
   * ```typescript
   * const result = await client.decideAndExecute({
   *   tenantId: 'tenant-123',
   *   actorId: 'user-456',
   *   action: 'execute_workflow',
   *   resourceType: 'workflow',
   *   resourceId: 'workflow-789',
   *   parameters: { workflowId: 'workflow-789' },
   * });
   * ```
   */
  async decideAndExecute(params: {
    tenantId: string;
    actorId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    parameters: Record<string, unknown>;
    context?: Record<string, unknown>;
    correlationId?: CorrelationId;
  }): Promise<ExecutionResult> {
    const receipt = await this.decide({
      tenantId: params.tenantId,
      actorId: params.actorId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      context: params.context,
      correlationId: params.correlationId,
    });

    return this.execute({
      receipt,
      action: params.action,
      parameters: params.parameters,
      correlationId: params.correlationId,
    });
  }

  /**
   * Generate canonical CorrelationId: t:<TenantId>|c:<uuidv7>
   */
  private generateCorrelationId(tenantId: string): CorrelationId {
    const uuid = generateUuidv7();
    return `t:${tenantId}|c:${uuid}`;
  }
}
