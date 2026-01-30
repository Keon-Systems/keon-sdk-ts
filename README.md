# Keon TypeScript SDK

> **Governance-first execution platform** - Law before action, safety by default

Safe-by-default TypeScript client for Keon Runtime with strict validation, automatic retries, and structured error handling.

## 🎯 Core Principles

1. **Law before execution** - Every action requires a policy decision
2. **Execute requires receipt** - Hard fail if `DecisionReceiptId` is absent
3. **CorrelationId is mandatory** - Canonical format: `t:<TenantId>|c:<uuidv7>`
4. **Bounded retries** - Automatic retries for transient failures with exponential backoff

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @keon/sdk

# Using npm
npm install @keon/sdk

# Using yarn
yarn add @keon/sdk
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { KeonClient } from '@keon/sdk';

const client = new KeonClient({
  baseUrl: 'https://api.keon.systems/runtime/v1',
  apiKey: 'your-api-key',
});

// 1. Request a policy decision
const receipt = await client.decide({
  tenantId: 'tenant-123',
  actorId: 'user-456',
  action: 'execute_workflow',
  resourceType: 'workflow',
  resourceId: 'workflow-789',
  context: { environment: 'production' },
});

// 2. Execute (requires receipt)
if (receipt.decision === 'allow') {
  const result = await client.execute({
    receipt,
    action: 'execute_workflow',
    parameters: { workflowId: 'workflow-789' },
  });

  console.log('Execution result:', result);
}
```

### Decide and Execute (Convenience Method)

```typescript
// Automatically handles decision + execution in one call
try {
  const result = await client.decideAndExecute({
    tenantId: 'tenant-123',
    actorId: 'user-456',
    action: 'delete_resource',
    resourceType: 'document',
    resourceId: 'doc-456',
    parameters: { force: false },
  });

  console.log('Success:', result);
} catch (error) {
  if (error instanceof ExecutionDeniedError) {
    console.log('Policy denied:', error.message);
  }
}
```

### Error Handling

```typescript
import {
  ExecutionDeniedError,
  InvalidCorrelationIdError,
  MissingReceiptError,
  NetworkError,
  ServerError,
} from '@keon/sdk';

try {
  const result = await client.decideAndExecute({
    tenantId: 'tenant-123',
    actorId: 'user-456',
    action: 'sensitive_operation',
    resourceType: 'data',
    resourceId: 'data-123',
    parameters: {},
  });
} catch (error) {
  if (error instanceof ExecutionDeniedError) {
    console.log('Policy denied:', error.message);
    console.log('Reason:', error.details);
  } else if (error instanceof InvalidCorrelationIdError) {
    console.log('Invalid correlation ID:', error.message);
  } else if (error instanceof MissingReceiptError) {
    console.log('Missing receipt:', error.message);
  } else if (error instanceof NetworkError) {
    console.log('Network error:', error.message);
  } else if (error instanceof ServerError) {
    console.log('Server error:', error.message);
  }
}
```

## 📖 API Reference

### KeonClient

```typescript
class KeonClient {
  constructor(config?: KeonClientConfig);
  decide(params: DecideParams): Promise<DecisionReceipt>;
  execute(params: ExecuteParams): Promise<ExecutionResult>;
  decideAndExecute(params: DecideAndExecuteParams): Promise<ExecutionResult>;
}
```

#### Configuration

```typescript
interface KeonClientConfig {
  baseUrl?: string;              // Default: 'http://localhost:8080/runtime/v1'
  apiKey?: string;               // Optional API key
  bearerToken?: string;          // Optional bearer token
  retryPolicy?: RetryPolicy;     // Default: RetryPolicy.default()
  timeout?: number;              // Default: 30000ms
  gateway?: RuntimeGateway;      // Optional custom gateway
}
```

#### decide()

Request a policy decision.

```typescript
await client.decide({
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  context?: Record<string, unknown>;
  correlationId?: CorrelationId;  // Auto-generated if not provided
});
```

**Returns:** `DecisionReceipt` with `decision` (allow/deny) and `receiptId`

**Throws:**
- `InvalidCorrelationIdError` - CorrelationId format invalid
- `ValidationError` - Request validation failed
- `NetworkError` - Connection/timeout issues
- `ServerError` - 5xx server errors

#### execute()

Execute an action with a decision receipt.

```typescript
await client.execute({
  receipt: DecisionReceipt;       // REQUIRED - from decide()
  action: string;
  parameters: Record<string, unknown>;
  correlationId?: CorrelationId;  // Optional override
});
```

**Returns:** `ExecutionResult` with `status` and `result`

**Throws:**
- `MissingReceiptError` - Receipt is missing or invalid
- `ExecutionDeniedError` - Receipt has decision=deny
- `InvalidCorrelationIdError` - CorrelationId format invalid
- `ValidationError` - Request validation failed
- `NetworkError` - Connection/timeout issues
- `ServerError` - 5xx server errors

#### decideAndExecute()

Decide and execute in one call (convenience method).

```typescript
await client.decideAndExecute({
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  parameters: Record<string, unknown>;
  context?: Record<string, unknown>;
  correlationId?: CorrelationId;
});
```

**Returns:** `ExecutionResult` if allowed

**Throws:** Same as `execute()`

### Retry Policy

```typescript
// Default retry policy (3 attempts with exponential backoff)
RetryPolicy.default()

// No retries
RetryPolicy.none()

// Custom retry policy
new RetryPolicy({
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 1000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
})
```

### Custom Gateway

```typescript
import { RuntimeGateway } from '@keon/sdk';

class CustomGateway implements RuntimeGateway {
  async decide(request: DecideRequest): Promise<DecideResponse> {
    // Custom implementation
  }

  async execute(request: ExecuteRequest): Promise<ExecuteResponse> {
    // Custom implementation
  }
}

const client = new KeonClient({
  gateway: new CustomGateway(),
});
```

## ⚠️ Common Mistakes

### ❌ WRONG: Calling execute() without a receipt

```typescript
// This will throw MissingReceiptError
await client.execute({
  receipt: null,
  action: 'test',
  parameters: {},
});
```

**✅ CORRECT:** Always call `decide()` first

```typescript
const receipt = await client.decide({
  tenantId: 'tenant-123',
  actorId: 'user-456',
  action: 'test',
  resourceType: 'resource',
  resourceId: 'res-1',
});

await client.execute({
  receipt,
  action: 'test',
  parameters: {},
});
```

### ❌ WRONG: Ignoring decision=deny

```typescript
const receipt = await client.decide({ /* ... */ });

// This will throw ExecutionDeniedError if decision=deny
await client.execute({ receipt, /* ... */ });
```

**✅ CORRECT:** Check decision before executing

```typescript
const receipt = await client.decide({ /* ... */ });

if (receipt.decision === 'allow') {
  await client.execute({ receipt, /* ... */ });
} else {
  console.log('Denied:', receipt.reason);
}
```

### ❌ WRONG: Invalid CorrelationId format

```typescript
// This will throw InvalidCorrelationIdError
await client.decide({
  tenantId: 'tenant-123',
  actorId: 'user-456',
  action: 'test',
  resourceType: 'resource',
  resourceId: 'res-1',
  correlationId: 'invalid-format',  // ❌ Not canonical format
});
```

**✅ CORRECT:** Use canonical format or let SDK auto-generate

```typescript
// Auto-generate (recommended)
await client.decide({
  tenantId: 'tenant-123',
  actorId: 'user-456',
  action: 'test',
  resourceType: 'resource',
  resourceId: 'res-1',
  // correlationId will be auto-generated
});

// Or use canonical format
await client.decide({
  tenantId: 'tenant-123',
  actorId: 'user-456',
  action: 'test',
  resourceType: 'resource',
  resourceId: 'res-1',
  correlationId: 't:tenant-123|c:01932b3c-4d5e-7890-abcd-ef1234567890',
});
```

## 🧪 Testing

Run tests:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please read the contributing guidelines first.

## 📚 Documentation

- [Keon Runtime API](https://api.keon.systems/docs)
- [Architecture Guide](https://docs.keon.systems/architecture)
- [Policy Guide](https://docs.keon.systems/policies)
