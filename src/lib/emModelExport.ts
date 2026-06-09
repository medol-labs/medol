import { parseMedol } from './dslParser';
import type { EmModel } from './model';

export const emModelToJson = (model: EmModel): string => JSON.stringify(model, null, 2);

export const medolToEmModelJson = (medol: string): string => emModelToJson(parseMedol(medol));
export const dslToEmModelJson = medolToEmModelJson;
