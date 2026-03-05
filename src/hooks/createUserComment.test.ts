import { describe, expect, it, vi } from 'vitest';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { createUserComment } from './createUserComment';

function createMockClient(result: { data: unknown; error: unknown }) {
  const invoke = vi.fn(async () => result);
  return {
    functions: {
      invoke,
    },
    invoke,
  };
}

describe('createUserComment', () => {
  it('throws CAPTCHA_FAILED when edge function rejects with captcha code', async () => {
    const response = new Response(
      JSON.stringify({ error: 'Verification failed', code: 'CAPTCHA_FAILED' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const client = createMockClient({
      data: null,
      error: new FunctionsHttpError(response),
    });

    await expect(
      createUserComment(client, {
        feedback_id: 'feedback-1',
        content: 'Comment',
        commenter_email: 'user@example.com',
        notify_on_reply: true,
        recaptcha_token: 'token',
      })
    ).rejects.toThrow('CAPTCHA_FAILED');
  });
});
