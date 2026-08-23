import packageJson from '../../../../package.json';

export const formatDocumentVersion = (version: string): string => {
  const normalized = version.trim().replace(/^v/i, '');
  const match = normalized.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return version.startsWith('V') ? version : `V${version}`;
  const [, major, minor = '0', patch = '0'] = match;
  return `V${major}.${minor}.${patch}`;
};

export const medolSoftwareVersion = formatDocumentVersion(packageJson.version);

