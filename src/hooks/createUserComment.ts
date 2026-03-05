import { FunctionsHttpError } from '@supabase/supabase-js';
import { Comment } from '@/types';

export interface CreateUserCommentInput {
  feedback_id: string;
  content: string;
  commenter_email: string;
  notify_on_reply: boolean;
  recaptcha_token: string;
}

type FunctionErrorPayload = {
  code?: string;
  error?: string;
} | null;

type VerifyCommentClient = {
  functions: {
    invoke: (
      functionName: string,
      options: { body: CreateUserCommentInput }
    ) => Promise<{ data: unknown; error: unknown }>;
  };
};

async function extractFunctionErrorPayload(error: unknown): Promise<FunctionErrorPayload> {
  if (!(error instanceof FunctionsHttpError)) {
    return null;
  }

  const context = error.context as Response | undefined;
  if (!context || typeof context.json !== 'function') {
    return null;
  }

  try {
    const payload = (await context.clone().json()) as FunctionErrorPayload;
    return payload;
  } catch {
    return null;
  }
}

export async function createUserComment(
  client: VerifyCommentClient,
  input: CreateUserCommentInput
): Promise<Comment> {
  const { data, error } = await client.functions.invoke('verify-comment', {
    body: input,
  });

  if (error) {
    const payload = await extractFunctionErrorPayload(error);

    if (payload?.code === 'CAPTCHA_FAILED') {
      throw new Error('CAPTCHA_FAILED');
    }

    if (payload?.error) {
      throw new Error(payload.error);
    }

    throw new Error('Failed to submit comment');
  }

  const payload = data as FunctionErrorPayload;
  if (payload?.code === 'CAPTCHA_FAILED') {
    throw new Error('CAPTCHA_FAILED');
  }

  if (payload?.error) {
    throw new Error(payload.error);
  }

  return data as Comment;
}
