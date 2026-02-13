# @keon/sdk

TypeScript SDK for Keon Runtime - Governance-first execution platform.

See the [main README](../../README.md) for complete documentation.

## Quick Start

```typescript
import { KeonClient } from '@keon/sdk';

const client = new KeonClient({
  baseUrl: 'https://api.keon.systems/runtime/v1',
  apiKey: 'your-api-key',
});

// Decide and execute
const result = await client.decideAndExecute({
  tenantId: 'tenant-123',
  actorId: 'user-456',
  action: 'execute_workflow',
  resourceType: 'workflow',
  resourceId: 'workflow-789',
  parameters: { workflowId: 'workflow-789' },
});
```

## Features

- ✅ **Safe by default** - Execute requires receipt, CorrelationId validated
- ✅ **Automatic retries** - Bounded retries with exponential backoff
- ✅ **Structured errors** - Typed exceptions for precise error handling
- ✅ **Runtime validation** - Zod-based schema validation
- ✅ **TypeScript first** - Full type safety and IntelliSense

## License

MIT
