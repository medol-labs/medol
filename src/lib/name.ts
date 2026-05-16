export const toDslId = (value: string | undefined, fallback = 'Item'): string => {
  const source = value?.trim() || fallback;
  const normalized = source
    .replace(/^[^a-zA-Z_]+/, '')
    .replace(/[^a-zA-Z0-9_]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/[^a-zA-Z0-9_]/g, '');

  if (!normalized) {
    return fallback;
  }

  return /^[a-zA-Z_]/.test(normalized) ? normalized : `${fallback}${normalized}`;
};

export const humanize = (id: string): string =>
  id
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();

export const quote = (value: string): string => JSON.stringify(value);

