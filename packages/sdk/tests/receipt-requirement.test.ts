/**
 * Receipt Requirement Tests
 *
 * Validates that:
 * - Execute REQUIRES a valid DecisionReceipt
 * - Execute HARD FAILS if receipt is missing
 * - Execute HARD FAILS if receipt has decision=deny
 * - Receipt validation is enforced before making requests
 */

import { describe, it, expect } from 'vitest';
import { KeonClient, MissingReceiptError, ExecutionDeniedError } from '../src';
import type { DecisionReceipt } from '@keon/contracts';

describe('Execute Receipt Requirement', () => {
  const mockAllowReceipt: DecisionReceipt = {
    receiptId: 'dr-allow',
    decision: 'allow',
    correlationId: 't:tenant-123|c:01932b3c-4d5e-7890-abcd-ef1234567890',
    tenantId: 'tenant-123',
    actorId: 'user-456',
    decidedAt: '2026-01-24T12:00:00Z',
    reason: 'Policy allows this action',
    appliedPolicies: ['P-123'],
  };

  const mockDenyReceipt: DecisionReceipt = {
    receiptId: 'dr-deny',
    decision: 'deny',
    correlationId: 't:tenant-123|c:01932b3c-4d5e-7890-abcd-ef1234567891',
    tenantId: 'tenant-123',
    actorId: 'user-456',
    decidedAt: '2026-01-24T12:00:00Z',
    reason: 'Policy denies this action',
    appliedPolicies: ['P-789'],
  };

  describe('Missing Receipt Validation', () => {
    it('rejects execute with null receipt', async () => {
      const client = new KeonClient();

      await expect(
        client.execute({
          receipt: null as any,
          action: 'test',
          parameters: {},
        })
      ).rejects.toThrow(MissingReceiptError);
    });

    it('rejects execute with undefined receipt', async () => {
      const client = new KeonClient();

      await expect(
        client.execute({
          receipt: undefined as any,
          action: 'test',
          parameters: {},
        })
      ).rejects.toThrow(MissingReceiptError);
    });

    it('rejects execute with receipt missing receiptId', async () => {
      const client = new KeonClient();

      const invalidReceipt = {
        ...mockAllowReceipt,
        receiptId: undefined,
      } as any;

      await expect(
        client.execute({
          receipt: invalidReceipt,
          action: 'test',
          parameters: {},
        })
      ).rejects.toThrow(MissingReceiptError);
    });

    it('rejects execute with empty receiptId', async () => {
      const client = new KeonClient();

      const invalidReceipt = {
        ...mockAllowReceipt,
        receiptId: '',
      };

      await expect(
        client.execute({
          receipt: invalidReceipt,
          action: 'test',
          parameters: {},
        })
      ).rejects.toThrow(MissingReceiptError);
    });
  });

  describe('Denied Receipt Validation', () => {
    it('rejects execute with decision=deny', async () => {
      const client = new KeonClient();

      await expect(
        client.execute({
          receipt: mockDenyReceipt,
          action: 'test',
          parameters: {},
        })
      ).rejects.toThrow(ExecutionDeniedError);
    });

    it('includes denial reason in error', async () => {
      const client = new KeonClient();

      try {
        await client.execute({
          receipt: mockDenyReceipt,
          action: 'test',
          parameters: {},
        });
        expect.fail('Should have thrown ExecutionDeniedError');
      } catch (error) {
        expect(error).toBeInstanceOf(ExecutionDeniedError);
        expect((error as ExecutionDeniedError).message).toContain('Policy denies this action');
      }
    });

    it('includes applied policies in error details', async () => {
      const client = new KeonClient();

      try {
        await client.execute({
          receipt: mockDenyReceipt,
          action: 'test',
          parameters: {},
        });
        expect.fail('Should have thrown ExecutionDeniedError');
      } catch (error) {
        expect(error).toBeInstanceOf(ExecutionDeniedError);
        expect((error as ExecutionDeniedError).details?.appliedPolicies).toEqual(['P-789']);
      }
    });
  });

  describe('Valid Receipt Flow', () => {
    it('accepts execute with valid allow receipt', async () => {
      const mockGateway = {
        decide: async () => {
          throw new Error('Not implemented');
        },
        execute: async (req: any) => {
          expect(req.decisionReceiptId).toBe('dr-allow');

          return {
            success: true,
            data: {
              executionId: 'ex-test',
              correlationId: req.correlationId,
              status: 'success' as const,
              executedAt: new Date().toISOString(),
              result: { message: 'Executed successfully' },
            },
          };
        },
      };

      const client = new KeonClient({ gateway: mockGateway });

      const result = await client.execute({
        receipt: mockAllowReceipt,
        action: 'test',
        parameters: { foo: 'bar' },
      });

      expect(result.executionId).toBe('ex-test');
      expect(result.status).toBe('success');
    });

    it('passes receiptId to gateway', async () => {
      let capturedReceiptId: string | undefined;

      const mockGateway = {
        decide: async () => {
          throw new Error('Not implemented');
        },
        execute: async (req: any) => {
          capturedReceiptId = req.decisionReceiptId;

          return {
            success: true,
            data: {
              executionId: 'ex-test',
              correlationId: req.correlationId,
              status: 'success' as const,
              executedAt: new Date().toISOString(),
              result: {},
            },
          };
        },
      };

      const client = new KeonClient({ gateway: mockGateway });

      await client.execute({
        receipt: mockAllowReceipt,
        action: 'test',
        parameters: {},
      });

      expect(capturedReceiptId).toBe('dr-allow');
    });
  });

  describe('decideAndExecute Flow', () => {
    it('executes when decision is allow', async () => {
      const mockGateway = {
        decide: async () => ({
          success: true as const,
          data: mockAllowReceipt,
        }),
        execute: async () => ({
          success: true as const,
          data: {
            executionId: 'ex-test',
            correlationId: mockAllowReceipt.correlationId,
            status: 'success' as const,
            executedAt: new Date().toISOString(),
            result: { message: 'Success' },
          },
        }),
      };

      const client = new KeonClient({ gateway: mockGateway });

      const result = await client.decideAndExecute({
        tenantId: 'tenant-123',
        actorId: 'user-456',
        action: 'test',
        resourceType: 'resource',
        resourceId: 'res-1',
        parameters: {},
      });

      expect(result.status).toBe('success');
    });

    it('throws ExecutionDeniedError when decision is deny', async () => {
      const mockGateway = {
        decide: async () => ({
          success: true as const,
          data: mockDenyReceipt,
        }),
        execute: async () => {
          throw new Error('Should not be called');
        },
      };

      const client = new KeonClient({ gateway: mockGateway });

      await expect(
        client.decideAndExecute({
          tenantId: 'tenant-123',
          actorId: 'user-456',
          action: 'test',
          resourceType: 'resource',
          resourceId: 'res-1',
          parameters: {},
        })
      ).rejects.toThrow(ExecutionDeniedError);
    });
  });
});
