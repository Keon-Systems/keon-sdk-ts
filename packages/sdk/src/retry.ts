/**
 * Keon SDK Retry Policy
 *
 * Bounded retry with exponential backoff for transient failures.
 */

export interface RetryPolicyConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** HTTP status codes that trigger retry */
  retryableStatusCodes: number[];
}

export class RetryPolicy {
  constructor(public readonly config: RetryPolicyConfig) {}

  /**
   * Default retry policy:
   * - 3 attempts (1 initial + 2 retries)
   * - Exponential backoff: 100ms, 200ms, 400ms
   * - Max delay: 1000ms
   * - Retry on: 408, 429, 500, 502, 503, 504
   */
  static default(): RetryPolicy {
    return new RetryPolicy({
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    });
  }

  /**
   * No retries
   */
  static none(): RetryPolicy {
    return new RetryPolicy({
      maxAttempts: 1,
      initialDelayMs: 0,
      maxDelayMs: 0,
      backoffMultiplier: 1,
      retryableStatusCodes: [],
    });
  }

  /**
   * Check if status code is retryable
   */
  isRetryable(statusCode: number): boolean {
    return this.config.retryableStatusCodes.includes(statusCode);
  }

  /**
   * Calculate delay for attempt number
   */
  getDelay(attempt: number): number {
    if (attempt <= 0) return 0;

    const delay = Math.min(
      this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1),
      this.config.maxDelayMs
    );

    return delay;
  }

  /**
   * Sleep for specified milliseconds
   */
  async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute function with retry
   */
  async execute<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: unknown, attempt: number) => boolean = () => true
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        const isLastAttempt = attempt === this.config.maxAttempts;
        if (isLastAttempt || !shouldRetry(error, attempt)) {
          throw error;
        }

        const delay = this.getDelay(attempt);
        if (delay > 0) {
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }
}
