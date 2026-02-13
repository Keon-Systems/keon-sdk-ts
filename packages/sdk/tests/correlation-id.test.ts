/**
 * Correlation ID Validation Tests
 *
 * Validates that:
 * - CorrelationId must be in canonical format: t:<TenantId>|c:<uuidv7>
 * - Invalid formats are rejected
 * - Extraction functions work correctly
 */

import { describe, it, expect } from 'vitest';
import {
  validateCorrelationId,
  isValidCorrelationId,
  extractTenantId,
} from '@keon/contracts';
import { KeonClient, InvalidCorrelationIdError } from '../src';

describe('CorrelationId Validation', () => {
  describe('Contract Validation', () => {
    it('accepts valid CorrelationId', () => {
      const valid = 't:tenant-123|c:01932b3c-4d5e-7890-abcd-ef1234567890';
      expect(isValidCorrelationId(valid)).toBe(true);
      expect(() => validateCorrelationId(valid)).not.toThrow();
    });

    it('rejects missing tenant prefix', () => {
      const invalid = 'tenant-123|c:01932b3c-4d5e-7890-abcd-ef1234567890';
      expect(isValidCorrelationId(invalid)).toBe(false);
      expect(() => validateCorrelationId(invalid)).toThrow();
    });

    it('rejects missing correlation prefix', () => {
      const invalid = 't:tenant-123|01932b3c-4d5e-7890-abcd-ef1234567890';
      expect(isValidCorrelationId(invalid)).toBe(false);
      expect(() => validateCorrelationId(invalid)).toThrow();
    });

    it('rejects missing separator', () => {
      const invalid = 't:tenant-123c:01932b3c-4d5e-7890-abcd-ef1234567890';
      expect(isValidCorrelationId(invalid)).toBe(false);
      expect(() => validateCorrelationId(invalid)).toThrow();
    });

    it('rejects non-UUIDv7 format', () => {
      // UUIDv4 instead of v7
      const invalid = 't:tenant-123|c:01932b3c-4d5e-4890-abcd-ef1234567890';
      expect(isValidCorrelationId(invalid)).toBe(false);
      expect(() => validateCorrelationId(invalid)).toThrow();
    });

    it('rejects arbitrary string', () => {
      const invalid = 'just-some-random-string';
      expect(isValidCorrelationId(invalid)).toBe(false);
      expect(() => validateCorrelationId(invalid)).toThrow();
    });

    it('extracts tenant ID correctly', () => {
      const correlationId = 't:tenant-123|c:01932b3c-4d5e-7890-abcd-ef1234567890';
      expect(extractTenantId(correlationId)).toBe('tenant-123');
    });

    it('handles complex tenant IDs', () => {
      const correlationId = 't:org-456:env-prod:tenant-789|c:01932b3c-4d5e-7890-abcd-ef1234567890';
      expect(extractTenantId(correlationId)).toBe('org-456:env-prod:tenant-789');
    });
  });

  describe('Client Validation', () => {
    it('rejects invalid CorrelationId in decide()', async () => {
      const client = new KeonClient();

      await expect(
        client.decide({
          tenantId: 'tenant-123',
          actorId: 'user-456',
          action: 'test',
          resourceType: 'resource',
          resourceId: 'res-1',
          correlationId: 'invalid-format',
        })
      ).rejects.toThrow(InvalidCorrelationIdError);
    });

    it('auto-generates valid CorrelationId if not provided', async () => {
      const mockGateway = {
        decide: async (req: any) => {
          expect(isValidCorrelationId(req.correlationId)).toBe(true);
          expect(req.correlationId).toMatch(/^t:tenant-123\|c:[0-9a-f-]+$/);

          return {
            success: true,
            data: {
              receiptId: 'dr-test',
              decision: 'allow' as const,
              correlationId: req.correlationId,
              tenantId: req.tenantId,
              actorId: req.actorId,
              decidedAt: new Date().toISOString(),
              reason: 'Test allowed',
              appliedPolicies: [],
            },
          };
        },
        execute: async () => {
          throw new Error('Not implemented');
        },
      };

      const client = new KeonClient({ gateway: mockGateway });

      const receipt = await client.decide({
        tenantId: 'tenant-123',
        actorId: 'user-456',
        action: 'test',
        resourceType: 'resource',
        resourceId: 'res-1',
      });

      expect(isValidCorrelationId(receipt.correlationId)).toBe(true);
    });

    it('preserves provided valid CorrelationId', async () => {
      const validCorrelationId = 't:tenant-123|c:01932b3c-4d5e-7890-abcd-ef1234567890';

      const mockGateway = {
        decide: async (req: any) => {
          expect(req.correlationId).toBe(validCorrelationId);

          return {
            success: true,
            data: {
              receiptId: 'dr-test',
              decision: 'allow' as const,
              correlationId: req.correlationId,
              tenantId: req.tenantId,
              actorId: req.actorId,
              decidedAt: new Date().toISOString(),
              reason: 'Test allowed',
              appliedPolicies: [],
            },
          };
        },
        execute: async () => {
          throw new Error('Not implemented');
        },
      };

      const client = new KeonClient({ gateway: mockGateway });

      const receipt = await client.decide({
        tenantId: 'tenant-123',
        actorId: 'user-456',
        action: 'test',
        resourceType: 'resource',
        resourceId: 'res-1',
        correlationId: validCorrelationId,
      });

      expect(receipt.correlationId).toBe(validCorrelationId);
    });
  });
});
