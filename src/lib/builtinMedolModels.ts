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
  if (fileName === 'data-exchange.medol') {
    const source = await import('../builtin-models/data-exchange.medol?raw');
    return source.default;
  }
  if (fileName === 'file-upload.medol') {
    const source = await import('../builtin-models/file-upload.medol?raw');
    return source.default;
  }
  if (fileName === 'system-notification.medol') {
    const source = await import('../builtin-models/system-notification.medol?raw');
    return source.default;
  }
  if (fileName === 'organization-management.medol') return (await import('../builtin-models/organization-management.medol?raw')).default;
  if (fileName === 'system-configuration.medol') return (await import('../builtin-models/system-configuration.medol?raw')).default;
  if (fileName === 'business-calendar.medol') return (await import('../builtin-models/business-calendar.medol?raw')).default;
  if (fileName === 'document-generation.medol') return (await import('../builtin-models/document-generation.medol?raw')).default;
  if (fileName === 'archiving.medol') return (await import('../builtin-models/archiving.medol?raw')).default;
  if (fileName === 'scheduling.medol') return (await import('../builtin-models/scheduling.medol?raw')).default;
  if (fileName === 'numbering.medol') {
    return (await import('../builtin-models/numbering.medol?raw')).default;
  }
  if (fileName === 'operation-audit.medol') {
    const source = await import('../builtin-models/operation-audit.medol?raw');
    return source.default;
  }
  if (fileName === 'tenant-management.medol') {
    const source = await import('../builtin-models/tenant-management.medol?raw');
    return source.default;
  }
  throw new Error(`Built-in Medol model not found: ${fileName}`);
};

const identityAccessManagementMedol = await loadBuiltinMedol('identity-access-management.medol');
const dictionaryMaintenanceMedol = await loadBuiltinMedol('dictionary-maintenance.medol');
const dataExchangeMedol = await loadBuiltinMedol('data-exchange.medol');
const fileUploadMedol = await loadBuiltinMedol('file-upload.medol');
const systemNotificationMedol = await loadBuiltinMedol('system-notification.medol');
const numberingMedol = await loadBuiltinMedol('numbering.medol');
const operationAuditMedol = await loadBuiltinMedol('operation-audit.medol');
const tenantManagementMedol = await loadBuiltinMedol('tenant-management.medol');

export const builtinMedolModels = new Map<string, string>([
  ['organization-management', await loadBuiltinMedol('organization-management.medol')],
  ['system-configuration', await loadBuiltinMedol('system-configuration.medol')],
  ['business-calendar', await loadBuiltinMedol('business-calendar.medol')],
  ['document-generation', await loadBuiltinMedol('document-generation.medol')],
  ['archiving', await loadBuiltinMedol('archiving.medol')],
  ['scheduling', await loadBuiltinMedol('scheduling.medol')],
  ['numbering', numberingMedol],
  ['operation-audit', operationAuditMedol],
  ['operationAudit', operationAuditMedol],
  ['tenant-management', tenantManagementMedol],
  ['tenantManagement', tenantManagementMedol],
  ['identity-access-management', identityAccessManagementMedol],
  ['identityAccessManagement', identityAccessManagementMedol],
  ['iam', identityAccessManagementMedol],
  ['dictionary-maintenance', dictionaryMaintenanceMedol],
  ['dictionaryMaintenance', dictionaryMaintenanceMedol],
  ['dictionary', dictionaryMaintenanceMedol],
  ['data-exchange', dataExchangeMedol],
  ['dataExchange', dataExchangeMedol],
  ['file-upload', fileUploadMedol],
  ['fileUpload', fileUploadMedol],
  ['file', fileUploadMedol],
  ['system-notification', systemNotificationMedol],
  ['systemNotification', systemNotificationMedol],
  ['notification', systemNotificationMedol],
  ['notifications', systemNotificationMedol]
]);

const builtinCapabilityNames = new Map([...builtinMedolModels].flatMap(([module, source]) =>
  [[module, extractBuiltinContextName(source)], [extractBuiltinContextName(source), extractBuiltinContextName(source)]] as Array<[string, string]>
));

export const resolveBuiltinMedolImport = (
  imported: MedolImportReference
): MedolSource | undefined => {
  const moduleName = imported.module ?? '';
  const source = builtinMedolModels.get(moduleName);
  if (!source) return undefined;
  return {
    sourceName: `<builtin:${moduleName}>`,
    builtin: true,
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

export const resolveBuiltinCapabilityName = (reference: string): string | undefined =>
  builtinCapabilityNames.get(reference);

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

function extractBuiltinContextName(text: string): string {
  const match = text.match(/\bcontext\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
  return match?.[1] ?? 'IdentityAccessManagement';
}
