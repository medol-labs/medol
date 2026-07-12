const maxDslLength = 2_000_000;
const maxMessageLength = 500;
const maxAuthorLength = 120;
const maxReleaseFieldLength = 120;
const maxReleaseNotesLength = 2000;

export const validateWorkspaceVersionInput = (
  body: {
    message?: unknown;
    dsl?: unknown;
    author?: unknown;
    releaseChannel?: unknown;
    releaseLabel?: unknown;
    releaseNotes?: unknown;
  }
): {
  message?: string;
  dsl?: string;
  author?: string;
  releaseChannel?: string;
  releaseLabel?: string;
  releaseNotes?: string;
  error?: string;
} => {
  const message = typeof body.message === 'string' ? body.message.trim() : undefined;
  const author = typeof body.author === 'string' ? body.author.trim() : undefined;
  const releaseChannel = typeof body.releaseChannel === 'string' ? body.releaseChannel.trim() : undefined;
  const releaseLabel = typeof body.releaseLabel === 'string' ? body.releaseLabel.trim() : undefined;
  const releaseNotes = typeof body.releaseNotes === 'string' ? body.releaseNotes.trim() : undefined;

  if (body.message !== undefined && !message) return { error: 'message must not be empty' };
  if (message && message.length > maxMessageLength) return { error: 'message is too long' };
  if (body.author !== undefined && !author) return { error: 'author must not be empty' };
  if (author && author.length > maxAuthorLength) return { error: 'author is too long' };
  if (body.releaseChannel !== undefined && !releaseChannel) return { error: 'release channel must not be empty' };
  if (releaseChannel && releaseChannel.length > maxReleaseFieldLength) {
    return { error: 'release channel is too long' };
  }
  if (releaseLabel && releaseLabel.length > maxReleaseFieldLength) {
    return { error: 'release label is too long' };
  }
  if (releaseNotes && releaseNotes.length > maxReleaseNotesLength) {
    return { error: 'release notes are too long' };
  }
  if ((releaseLabel || releaseNotes) && !releaseChannel) {
    return { error: 'release channel is required for release metadata' };
  }
  if (body.dsl !== undefined && typeof body.dsl !== 'string') {
    return { error: 'dsl must be a string' };
  }
  if (typeof body.dsl === 'string' && body.dsl.length > maxDslLength) {
    return { error: 'dsl is too large' };
  }

  return {
    ...(message ? { message } : {}),
    ...(typeof body.dsl === 'string' ? { dsl: body.dsl } : {}),
    ...(author ? { author } : {}),
    ...(releaseChannel ? { releaseChannel } : {}),
    ...(releaseLabel ? { releaseLabel } : {}),
    ...(releaseNotes ? { releaseNotes } : {})
  };
};
