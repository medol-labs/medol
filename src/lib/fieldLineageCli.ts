import { analyzeFieldLineage } from './fieldLineage';
import { parseMedolFile } from './medolProject';

const path = process.argv[2];
if (!path) {
  console.error('Usage: npm run medol:check -- model.medol [--json]');
  process.exitCode = 1;
} else {
  try {
    const model = parseMedolFile(path);
    const lineage = analyzeFieldLineage(model);
    const errors = lineage.diagnostics.filter((item) => item.severity === 'error');
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ valid: !model.diagnostics.length && !errors.length,
        modelDiagnostics: model.diagnosticDetails, ...lineage }, null, 2));
    } else {
      for (const diagnostic of model.diagnostics) console.error(diagnostic);
      for (const diagnostic of lineage.diagnostics) {
        const field = lineage.fields.find((item) => item.id === diagnostic.fieldId)!;
        const location = field.range ? `${field.range.sourceName ?? path}:${field.range.start.line}:${field.range.start.column}` : path;
        console.log(`${location} ${diagnostic.severity} [${diagnostic.code}] ${diagnostic.message}`);
      }
      console.log(`${lineage.fields.length} fields; ${model.diagnostics.length + errors.length} errors; ${lineage.diagnostics.length - errors.length} review warnings.`);
    }
    if (model.diagnostics.length || errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
