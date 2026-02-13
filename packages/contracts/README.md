# @keon/contracts

TypeScript contracts for Keon Runtime API.

Auto-generated from OpenAPI specification.

## Usage

```typescript
import {
  DecideRequest,
  DecideResponse,
  ExecuteRequest,
  ExecuteResponse,
  DecisionReceipt,
  ExecutionResult,
  CorrelationId,
  validateCorrelationId,
  isValidCorrelationId,
  extractTenantId,
} from '@keon/contracts';
```

## Validation

```typescript
import { validateCorrelationId, isValidCorrelationId } from '@keon/contracts';

// Check validity
if (isValidCorrelationId(correlationId)) {
  // Valid
}

// Validate and throw on error
validateCorrelationId(correlationId);
```

## CorrelationId Format

Canonical format: `t:<TenantId>|c:<uuidv7>`

Example: `t:tenant-123|c:01932b3c-4d5e-7890-abcd-ef1234567890`

## License

MIT
