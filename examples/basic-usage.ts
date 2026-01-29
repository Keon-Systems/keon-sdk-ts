/**
 * Keon SDK - Basic Usage Example
 *
 * This example demonstrates the basic workflow:
 * 1. Create a client
 * 2. Request a policy decision
 * 3. Execute if allowed
 */

import { KeonClient, ExecutionDeniedError } from '@keon/sdk';

async function main() {
  // Create client
  const client = new KeonClient({
    baseUrl: 'https://api.keon.systems/runtime/v1',
    apiKey: process.env.KEON_API_KEY,
  });

  try {
    // Example 1: Separate decide and execute
    console.log('Example 1: Separate decide and execute');

    const receipt = await client.decide({
      tenantId: 'tenant-123',
      actorId: 'user-456',
      action: 'execute_workflow',
      resourceType: 'workflow',
      resourceId: 'workflow-789',
      context: {
        environment: 'production',
        requestedBy: 'api',
      },
    });

    console.log('Decision:', receipt.decision);
    console.log('Reason:', receipt.reason);

    if (receipt.decision === 'allow') {
      const result = await client.execute({
        receipt,
        action: 'execute_workflow',
        parameters: {
          workflowId: 'workflow-789',
          inputs: { foo: 'bar' },
        },
      });

      console.log('Execution result:', result);
    }

    // Example 2: decideAndExecute (convenience method)
    console.log('\nExample 2: decideAndExecute');

    const result = await client.decideAndExecute({
      tenantId: 'tenant-123',
      actorId: 'user-456',
      action: 'delete_resource',
      resourceType: 'document',
      resourceId: 'doc-456',
      parameters: {
        force: false,
      },
    });

    console.log('Execution result:', result);
  } catch (error) {
    if (error instanceof ExecutionDeniedError) {
      console.error('Policy denied:', error.message);
      console.error('Details:', error.details);
    } else {
      console.error('Error:', error);
    }
  }
}

main().catch(console.error);
