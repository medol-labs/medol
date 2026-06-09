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

export const medolToCodegenModel = (medol: string) => modelToCodegenModel(parseMedol(medol));

export const modelToConfig = (model: EmModel): ConfigRoot =>
  codegenModelToConfig(modelToCodegenModel(model));

export const medolToConfig = (medol: string): ConfigRoot =>
  codegenModelToConfig(medolToCodegenModel(medol));

export const dslToCodegenModel = medolToCodegenModel;
export const dslToConfig = medolToConfig;
