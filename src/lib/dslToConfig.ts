import { parseMedol } from './dslParser';
import type { EmModel } from './model';
import { modelToCodegenModel } from './codegenModel';
import { codegenModelToConfig } from './codegenToConfig';
import type { ConfigRoot } from './codegenToConfig';

export type { ConfigRoot } from './codegenToConfig';
export type {
  CodegenAggregate,
  CodegenContext,
  CodegenDependency,
  CodegenElement,
  CodegenField,
  CodegenFieldSource,
  CodegenModel,
  CodegenSlice,
  CodegenSpecification
} from './codegenModel';
export { modelToCodegenModel } from './codegenModel';
export { codegenModelToConfig } from './codegenToConfig';

export class MedolValidationError extends Error {
  constructor(readonly diagnostics: string[]) {
    super(`MEDOL validation failed:\n${diagnostics.map((diagnostic) => `- ${diagnostic}`).join('\n')}`);
    this.name = 'MedolValidationError';
  }
}

export const medolToCodegenModel = (medol: string) => {
  const model = parseMedol(medol);
  if (model.diagnostics.length > 0) throw new MedolValidationError(model.diagnostics);
  return modelToCodegenModel(model);
};

export const modelToConfig = (model: EmModel): ConfigRoot =>
  codegenModelToConfig(modelToCodegenModel(model));

export const medolToConfig = (medol: string): ConfigRoot =>
  codegenModelToConfig(medolToCodegenModel(medol));

export const dslToCodegenModel = medolToCodegenModel;
export const dslToConfig = medolToConfig;
