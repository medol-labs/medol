import type { EmModel } from '../model';

export interface Generator<TOutput, TOptions = unknown> {
  id: string;
  label: string;
  generate(model: EmModel, options?: TOptions): TOutput | Promise<TOutput>;
}
