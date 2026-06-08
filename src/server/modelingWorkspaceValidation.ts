const maxDslLength = 2_000_000;
const maxNameLength = 120;

export const validateWorkspaceInput = (
  body: { name?: unknown; dsl?: unknown },
  nameRequired: boolean
): { name?: string; dsl?: string; error?: string } => {
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  if (nameRequired && !name) return { error: 'name is required' };
  if (body.name !== undefined && !name) return { error: 'name must not be empty' };
  if (name && name.length > maxNameLength) return { error: 'name is too long' };
  if (body.dsl !== undefined && typeof body.dsl !== 'string') {
    return { error: 'dsl must be a string' };
  }
  if (typeof body.dsl === 'string' && body.dsl.length > maxDslLength) {
    return { error: 'dsl is too large' };
  }

  return {
    ...(name ? { name } : {}),
    ...(typeof body.dsl === 'string' ? { dsl: body.dsl } : {})
  };
};
