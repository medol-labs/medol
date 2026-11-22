import { z } from 'zod';

const line = z.string().trim().min(1).regex(/^[^\r\n]+$/);
const id = z.string().regex(/^[A-Z][A-Z0-9-]*$/);
const list = <T extends z.ZodType>(item: T) => z.array(item).min(1);
const references = list(id);
const modelReference = z.string().regex(/^[\p{L}\p{N}_]+(?:\.[\p{L}\p{N}_]+)+$/u);
const titled = { id, title: line };
const sourced = { ...titled, sources: references };
const traceable = { ...sourced, requirements: references };

export const gbt8567MaterialsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  project: line,
  scope: line,
  revision: line,
  architecture: list(line),
  components: z.array(z.strictObject({
    ...sourced,
    role: line,
    boundary: line,
    designs: references,
    modelUnit: line.optional(),
  })).optional(),
  sources: list(z.strictObject({ ...titled, path: line })),
  requirements: list(z.strictObject({
    ...sourced,
    statement: line,
    acceptance: line,
    qualification: z.enum(['测试', '演示', '检查', '分析']),
  })),
  designs: list(z.strictObject({
    ...traceable,
    component: line,
    decision: line,
    rationale: line,
    details: z.array(z.strictObject({ title: line, points: list(line) })).optional(),
    workflows: z.array(modelReference).default([]),
  })),
  storage: list(z.strictObject({
    ...traceable,
    owner: line,
    physical: line,
    lifecycle: line,
    access: line,
    integrity: list(line).optional(),
    recovery: line.optional(),
    projections: z.array(modelReference).default([]),
  })),
  interfaces: z.array(z.strictObject({
    ...traceable,
    designs: references,
    verificationTests: references,
    provider: line,
    consumer: line,
    obligation: line,
    contract: line,
    correlation: line,
    failure: line,
  })).optional(),
  indicators: z.array(z.strictObject({
    ...traceable,
    baseline: line,
    measure: line,
    criterion: line,
    basis: z.enum(['模型判据', '计划工况', '目标待定']),
    verificationTests: references,
  })).default([]),
  environment: list(line),
  tests: list(z.strictObject({
    ...traceable,
    preconditions: list(line),
    evidence: list(line).optional(),
    cleanup: line.optional(),
    modelScenarios: z.array(z.strictObject({ workflow: modelReference, scenario: line })).optional(),
    steps: list(z.strictObject({ action: line, expected: line })),
  })),
});

export type Gbt8567Materials = z.infer<typeof gbt8567MaterialsSchema>;
