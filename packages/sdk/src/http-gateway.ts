/**
 * Keon SDK HTTP Gateway
 *
 * HTTP implementation of RuntimeGateway with:
 * - Fetch API (node + browser compatible)
 * - Automatic retries
 * - Structured error handling
 * - Request/response logging
 */

import type {
  DecideRequest,
  DecideResponse,
  ExecuteRequest,
  ExecuteResponse,
  ErrorResponse,
} from '@keon/contracts';
import type { RuntimeGateway } from './gateway';
import { RetryPolicy } from './retry';
import {
  KeonError,
  ClientError,
  NetworkError,
  ServerError,
  TimeoutError,
  ValidationError,
} from './errors';

export interface HttpGatewayConfig {
  baseUrl: string;
  apiKey?: string;
  bearerToken?: string;
  timeout: number;
  retryPolicy: RetryPolicy;
  headers?: Record<string, string>;
}

export class HttpRuntimeGateway implements RuntimeGateway {
  constructor(private readonly config: HttpGatewayConfig) {}

  async decide(request: DecideRequest): Promise<DecideResponse> {
    return this.post<DecideResponse>('/decide', request);
  }

  async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
    return this.post<ExecuteResponse>('/execute', request);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;

    const shouldRetry = (error: unknown, attempt: number): boolean => {
      if (error instanceof ServerError) {
        return this.config.retryPolicy.isRetryable(error.statusCode);
      }
      if (error instanceof TimeoutError) {
        return true;
      }
      return false;
    };

    return this.config.retryPolicy.execute(
      () => this.makeRequest<T>(url, body),
      shouldRetry
    );
  }

  private async makeRequest<T>(url: string, body: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    if (this.config.bearerToken) {
      headers['Authorization'] = `Bearer ${this.config.bearerToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof KeonError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new TimeoutError();
      }

      throw new NetworkError(
        `Network request failed: ${(error as Error).message}`
      );
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: ErrorResponse | undefined;

    try {
      errorData = await response.json();
    } catch {
      // Failed to parse error response
    }

    const message = errorData?.error?.message || response.statusText;
    const correlationId = errorData?.error?.correlationId;
    const details = errorData?.error?.details;

    if (response.status >= 500) {
      throw new ServerError(message, response.status, correlationId, details);
    }

    if (response.status === 400) {
      throw new ValidationError(message, correlationId, details);
    }

    throw new ClientError(message, response.status, correlationId, details);
  }
}
