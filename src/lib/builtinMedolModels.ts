import type { MedolImportReference, MedolSource } from './dslParser';

const loadIdentityAccessManagementMedol = async (): Promise<string> => {
  if (typeof window === 'undefined') {
    const importNodeModule = new Function('specifier', 'return import(specifier)') as (
      specifier: string
    ) => Promise<typeof import('node:fs')>;
    const { readFileSync } = await importNodeModule('node:fs');
    return readFileSync(
      new URL('../builtin-models/identity-access-management.medol', import.meta.url),
      'utf8'
    );
  }

  const source = await import('../builtin-models/identity-access-management.medol?raw');
  return source.default;
};

const identityAccessManagementMedol = await loadIdentityAccessManagementMedol();

export const builtinMedolModels = new Map<string, string>([
  ['identity-access-management', identityAccessManagementMedol],
  ['identityAccessManagement', identityAccessManagementMedol],
  ['iam', identityAccessManagementMedol]
]);

export const resolveBuiltinMedolImport = (
  imported: MedolImportReference
): MedolSource | undefined => {
  const moduleName = imported.module ?? '';
  const source = builtinMedolModels.get(moduleName);
  if (!source) return undefined;
  return {
    sourceName: `<builtin:${moduleName}>`,
    text: appendBuiltinDeployment(source, imported.deployment)
  };
};

export const resolveBuiltinDeploymentOnlyImport = (
  imported: MedolImportReference
): MedolSource | undefined => {
  const moduleName = imported.module ?? '';
  const source = builtinMedolModels.get(moduleName);
  if (!source) return undefined;
  return {
    sourceName: `<builtin:${moduleName}:deployment:${imported.deployment ?? extractBuiltinContextName(source)}>`,
    text: builtinDeployment(source, imported.deployment)
  };
};

export const supportedBuiltinMedolImports = (): string[] => [...builtinMedolModels.keys()];

const appendBuiltinDeployment = (text: string, deployment?: string): string => {
  return `${text}

${builtinDeployment(text, deployment)}`;
};

const builtinDeployment = (text: string, deployment?: string): string => {
  const normalizedDeployment = deployment?.trim() || extractBuiltinContextName(text);
  return `deployment ${normalizedDeployment} {
  includes ${extractBuiltinContextName(text)}
}
`;
};

const extractBuiltinContextName = (text: string): string => {
  const match = text.match(/\bcontext\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
  return match?.[1] ?? 'IdentityAccessManagement';
};
