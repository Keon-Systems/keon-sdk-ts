/**
 * Keon SDK Gateway Protocol
 *
 * Abstract interface for runtime communication.
 * Allows pluggable transports (HTTP, gRPC, in-memory, etc.)
 */

import type {
  DecideRequest,
  DecideResponse,
  ExecuteRequest,
  ExecuteResponse,
} from '@keon/contracts';

/**
 * RuntimeGateway protocol
 *
 * Abstraction for communicating with Keon Runtime.
 * Implementations handle transport, auth, retries, etc.
 */
export interface RuntimeGateway {
  /**
   * Request a policy decision
   */
  decide(request: DecideRequest): Promise<DecideResponse>;

  /**
   * Execute an action with a decision receipt
   */
  execute(request: ExecuteRequest): Promise<ExecuteResponse>;
}
