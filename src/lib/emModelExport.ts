import { parseEventModelingDsl } from './dslParser';
import type { EmModel } from './model';

export const emModelToJson = (model: EmModel): string => JSON.stringify(model, null, 2);

export const dslToEmModelJson = (dsl: string): string => emModelToJson(parseEventModelingDsl(dsl));
