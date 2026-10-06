import type { MedolImportReference, MedolSource } from './dslParser';

const loadBuiltinMedol = async (fileName: string): Promise<string> => {
  if (typeof window === 'undefined') {
    const importNodeModule = new Function('specifier', 'return import(specifier)') as (
      specifier: string
    ) => Promise<typeof import('node:fs')>;
    const { readFileSync } = await importNodeModule('node:fs');
    return readFileSync(
      new URL(`../builtin-models/${fileName}`, import.meta.url),
      'utf8'
    );
  }

  if (fileName === 'identity-access-management.medol') {
    const source = await import('../builtin-models/identity-access-management.medol?raw');
    return source.default;
  }
  if (fileName === 'dictionary-maintenance.medol') {
    const source = await import('../builtin-models/dictionary-maintenance.medol?raw');
    return source.default;
  }
  if (fileName === 'file-upload.medol') {
    const source = await import('../builtin-models/file-upload.medol?raw');
    return source.default;
  }
  throw new Error(`Built-in Medol model not found: ${fileName}`);
};

const identityAccessManagementMedol = await loadBuiltinMedol('identity-access-management.medol');
const dictionaryMaintenanceMedol = await loadBuiltinMedol('dictionary-maintenance.medol');
const fileUploadMedol = await loadBuiltinMedol('file-upload.medol');

export const builtinMedolModels = new Map<string, string>([
  ['identity-access-management', identityAccessManagementMedol],
  ['identityAccessManagement', identityAccessManagementMedol],
  ['iam', identityAccessManagementMedol],
  ['dictionary-maintenance', dictionaryMaintenanceMedol],
  ['dictionaryMaintenance', dictionaryMaintenanceMedol],
  ['dictionary', dictionaryMaintenanceMedol],
  ['file-upload', fileUploadMedol],
  ['fileUpload', fileUploadMedol],
  ['file', fileUploadMedol]
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
