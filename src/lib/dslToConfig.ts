import { parseEventModelingDsl } from './dslParser';
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

export const dslToCodegenModel = (dsl: string) => modelToCodegenModel(parseEventModelingDsl(dsl));

export const modelToConfig = (model: EmModel): ConfigRoot =>
  codegenModelToConfig(modelToCodegenModel(model));

export const dslToConfig = (dsl: string): ConfigRoot =>
  codegenModelToConfig(dslToCodegenModel(dsl));
