import { resolveBuiltinCapabilityName } from './builtinMedolModels';
import type { EmCapabilityExtension, EmModel } from './model';

export const resolveCapabilityReferences = (model: EmModel, name: string): {
  extensions: EmCapabilityExtension[];
  diagnostics: string[];
} => {
  const diagnostics: string[] = [];
  const aliases = new Map<string, string>();
  for (const imported of model.capabilityImports ?? []) {
    if (!imported.alias) continue;
    const existing = aliases.get(imported.alias) ?? resolveBuiltinCapabilityName(imported.alias);
    if (existing && existing !== imported.name) {
      diagnostics.push(`Capability alias ${imported.alias} refers to conflicting capabilities ${existing} and ${imported.name}.`);
    } else {
      aliases.set(imported.alias, imported.name);
    }
  }
  const extensions = model.capabilityExtensions.filter((extension) =>
    (aliases.get(extension.target)
      ?? resolveBuiltinCapabilityName(extension.target)
      ?? extension.target) === name
  );
  return {
    extensions,
    diagnostics: [...new Set(diagnostics)]
  };
};
