/**
 * AI Call Adapter for Keon
 *
 * Wraps AI provider calls (OpenAI, Anthropic, etc.) with Keon governance.
 * Every AI call goes through decide → execute → evidence.
 *
 * Example:
 * ```typescript
 * import { KeonClient } from '@keon/sdk';
 * import { createAIAdapter, OpenAIProvider } from '@keon/sdk/adapters/ai';
 *
 * const client = new KeonClient({ baseUrl: '...', apiKey: '...' });
 * const ai = createAIAdapter(client, {
 *   tenantId: 'tenant-123',
 *   actorId: 'user-456',
 *   provider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }),
 * });
 *
 * // Governed AI call
 * const response = await ai.chat({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 *
 * // response includes receipt for audit
 * console.log(response.receipt.receiptId);
 * ```
 */

import type { KeonClient } from '../client';
import type { DecisionReceipt, ExecutionResult } from '@keon/contracts';

/**
 * AI Provider interface - implement for each AI service
 */
export interface AIProvider {
  /** Provider name (e.g., 'openai', 'anthropic', 'gemini') */
  readonly name: string;

  /** Execute a chat completion */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /** Execute a text completion (if supported) */
  complete?(request: CompletionRequest): Promise<CompletionResponse>;

  /** Execute an embedding request (if supported) */
  embed?(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}

/**
 * Chat completion request
 */
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Chat message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string;
  name?: string;
  functionCall?: Record<string, unknown>;
  toolCalls?: Record<string, unknown>[];
}

/**
 * Chat completion response
 */
export interface ChatResponse {
  id: string;
  model: string;
  choices: ChatChoice[];
  usage?: TokenUsage;
}

/**
 * Chat choice
 */
export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finishReason: string;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Text completion request
 */
export interface CompletionRequest {
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  stop?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Text completion response
 */
export interface CompletionResponse {
  id: string;
  model: string;
  text: string;
  usage?: TokenUsage;
}

/**
 * Embedding request
 */
export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  metadata?: Record<string, unknown>;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  id: string;
  model: string;
  embeddings: number[][];
  usage?: TokenUsage;
}

/**
 * Governed AI response - includes receipt for audit
 */
export interface GovernedChatResponse extends ChatResponse {
  receipt: DecisionReceipt;
  execution: ExecutionResult;
}

export interface GovernedCompletionResponse extends CompletionResponse {
  receipt: DecisionReceipt;
  execution: ExecutionResult;
}

export interface GovernedEmbeddingResponse extends EmbeddingResponse {
  receipt: DecisionReceipt;
  execution: ExecutionResult;
}

/**
 * AI Adapter configuration
 */
export interface AIAdapterConfig {
  /** Tenant ID for governance */
  tenantId: string;

  /** Actor ID (user, agent, service) */
  actorId: string;

  /** AI provider implementation */
  provider: AIProvider;

  /** Default context for decisions */
  defaultContext?: Record<string, unknown>;

  /** Callback for decision denials */
  onDenied?: (receipt: DecisionReceipt) => void;

  /** Whether to throw on denial (default: true) */
  throwOnDenial?: boolean;
}

/**
 * Governed AI Adapter
 */
export class AIAdapter {
  private readonly client: KeonClient;
  private readonly config: AIAdapterConfig;

  constructor(client: KeonClient, config: AIAdapterConfig) {
    this.client = client;
    this.config = config;
  }

  /**
   * Execute a governed chat completion
   */
  async chat(request: ChatRequest): Promise<GovernedChatResponse> {
    const { tenantId, actorId, provider, defaultContext, onDenied, throwOnDenial = true } = this.config;

    // Step 1: Request decision
    const receipt = await this.client.decide({
      tenantId,
      actorId,
      action: 'ai.chat',
      resourceType: 'ai.model',
      resourceId: request.model,
      context: {
        ...defaultContext,
        ...request.metadata,
        provider: provider.name,
        messageCount: request.messages.length,
        model: request.model,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      },
    });

    // Step 2: Handle denial
    if (receipt.decision === 'deny') {
      onDenied?.(receipt);
      if (throwOnDenial) {
        throw new AIGovernanceError('AI call denied by policy', receipt);
      }
      // Return empty response with receipt
      return {
        id: '',
        model: request.model,
        choices: [],
        receipt,
        execution: {} as ExecutionResult,
      };
    }

    // Step 3: Execute the AI call
    const execution = await this.client.execute({
      receipt,
      action: 'ai.chat',
      parameters: {
        model: request.model,
        messageCount: request.messages.length,
      },
    });

    // Step 4: Make the actual AI call
    const response = await provider.chat(request);

    // Step 5: Return governed response
    return {
      ...response,
      receipt,
      execution,
    };
  }

  /**
   * Execute a governed text completion
   */
  async complete(request: CompletionRequest): Promise<GovernedCompletionResponse> {
    const { tenantId, actorId, provider, defaultContext, onDenied, throwOnDenial = true } = this.config;

    if (!provider.complete) {
      throw new Error(`Provider ${provider.name} does not support completions`);
    }

    // Step 1: Request decision
    const receipt = await this.client.decide({
      tenantId,
      actorId,
      action: 'ai.complete',
      resourceType: 'ai.model',
      resourceId: request.model,
      context: {
        ...defaultContext,
        ...request.metadata,
        provider: provider.name,
        promptLength: request.prompt.length,
        model: request.model,
        maxTokens: request.maxTokens,
      },
    });

    // Step 2: Handle denial
    if (receipt.decision === 'deny') {
      onDenied?.(receipt);
      if (throwOnDenial) {
        throw new AIGovernanceError('AI completion denied by policy', receipt);
      }
      return {
        id: '',
        model: request.model,
        text: '',
        receipt,
        execution: {} as ExecutionResult,
      };
    }

    // Step 3: Execute
    const execution = await this.client.execute({
      receipt,
      action: 'ai.complete',
      parameters: {
        model: request.model,
        promptLength: request.prompt.length,
      },
    });

    // Step 4: Make the actual AI call
    const response = await provider.complete(request);

    return {
      ...response,
      receipt,
      execution,
    };
  }

  /**
   * Execute a governed embedding request
   */
  async embed(request: EmbeddingRequest): Promise<GovernedEmbeddingResponse> {
    const { tenantId, actorId, provider, defaultContext, onDenied, throwOnDenial = true } = this.config;

    if (!provider.embed) {
      throw new Error(`Provider ${provider.name} does not support embeddings`);
    }

    const inputCount = Array.isArray(request.input) ? request.input.length : 1;

    // Step 1: Request decision
    const receipt = await this.client.decide({
      tenantId,
      actorId,
      action: 'ai.embed',
      resourceType: 'ai.model',
      resourceId: request.model,
      context: {
        ...defaultContext,
        ...request.metadata,
        provider: provider.name,
        inputCount,
        model: request.model,
      },
    });

    // Step 2: Handle denial
    if (receipt.decision === 'deny') {
      onDenied?.(receipt);
      if (throwOnDenial) {
        throw new AIGovernanceError('AI embedding denied by policy', receipt);
      }
      return {
        id: '',
        model: request.model,
        embeddings: [],
        receipt,
        execution: {} as ExecutionResult,
      };
    }

    // Step 3: Execute
    const execution = await this.client.execute({
      receipt,
      action: 'ai.embed',
      parameters: {
        model: request.model,
        inputCount,
      },
    });

    // Step 4: Make the actual AI call
    const response = await provider.embed(request);

    return {
      ...response,
      receipt,
      execution,
    };
  }
}

/**
 * Error thrown when AI call is denied by governance
 */
export class AIGovernanceError extends Error {
  readonly receipt: DecisionReceipt;

  constructor(message: string, receipt: DecisionReceipt) {
    super(message);
    this.name = 'AIGovernanceError';
    this.receipt = receipt;
  }
}

/**
 * Factory function to create an AI adapter
 */
export function createAIAdapter(client: KeonClient, config: AIAdapterConfig): AIAdapter {
  return new AIAdapter(client, config);
}
