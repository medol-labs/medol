const maxDslLength = 2_000_000;
const maxMessageLength = 500;
const maxAuthorLength = 120;

export const validateWorkspaceVersionInput = (
  body: { message?: unknown; dsl?: unknown; author?: unknown }
): { message?: string; dsl?: string; author?: string; error?: string } => {
  const message = typeof body.message === 'string' ? body.message.trim() : undefined;
  const author = typeof body.author === 'string' ? body.author.trim() : undefined;

  if (body.message !== undefined && !message) return { error: 'message must not be empty' };
  if (message && message.length > maxMessageLength) return { error: 'message is too long' };
  if (body.author !== undefined && !author) return { error: 'author must not be empty' };
  if (author && author.length > maxAuthorLength) return { error: 'author is too long' };
  if (body.dsl !== undefined && typeof body.dsl !== 'string') {
    return { error: 'dsl must be a string' };
  }
  if (typeof body.dsl === 'string' && body.dsl.length > maxDslLength) {
    return { error: 'dsl is too large' };
  }

  return {
    ...(message ? { message } : {}),
    ...(typeof body.dsl === 'string' ? { dsl: body.dsl } : {}),
    ...(author ? { author } : {})
  };
};
