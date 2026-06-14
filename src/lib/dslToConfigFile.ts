import { modelToCodegenModel } from './codegenModel';
import { codegenModelToConfig, type ConfigRoot } from './codegenToConfig';
import { MedolValidationError } from './dslToConfig';
import { parseMedolFile } from './medolProject';

export const medolFileToCodegenModel = (path: string) => {
  const model = parseMedolFile(path);
  if (model.diagnostics.length > 0) throw new MedolValidationError(model.diagnostics);
  return modelToCodegenModel(model);
};

export const medolFileToConfig = (path: string): ConfigRoot =>
  codegenModelToConfig(medolFileToCodegenModel(path));
